import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { parseNumber } from '../utils/numberInput';
import { roundRappen } from '../utils/money';
import { Upload, X, FileText, Image, Camera, Paperclip } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useCompany } from '../context/CompanyContext';
import { useAuth } from '../context/AuthProvider';
import type { RecurrenceInterval, Transaction, Customer, Project, Category } from '../lib/supabase';
import {
  buildCategoryOptions,
  defaultCategoryName,
  emptyToNull,
  transactionTypeFor,
} from '../utils/transactionCategories';

interface TransactionFormProps {
  transaction?: Transaction;
  onSubmit: (data: Partial<Transaction>) => Promise<void>;
  onCancel: () => void;
  customers: Customer[];
  projects: Project[];
  /** Bereits erfasste Lieferanten/Zahler der Firma (fuer Vorschlaege) */
  counterpartySuggestions?: string[];
}

export default function TransactionForm({ transaction, onSubmit, onCancel, customers, projects, counterpartySuggestions = [] }: TransactionFormProps) {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [activeTab, setActiveTab] = useState<'einnahme' | 'ausgabe'>(transaction?.type || 'ausgabe');
  const [transactionNumber, setTransactionNumber] = useState(transaction?.transaction_number || '');
  const [date, setDate] = useState(transaction?.date || new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState(transaction?.amount.toString() || '');
  // Kategorie wird als NAME gefuehrt, genau wie in transactions.category gespeichert.
  // (Frueher stand hier der Name, verglichen wurde aber mit der ID: Beim Bearbeiten
  // zeigte das Feld eine falsche Kategorie und beim Speichern wurde NULL geschrieben.)
  const [categoryName, setCategoryName] = useState(transaction?.category || '');
  const [description, setDescription] = useState(transaction?.description || '');
  const [counterparty, setCounterparty] = useState(transaction?.counterparty || '');
  const [customerId, setCustomerId] = useState(transaction?.customer_id || '');
  const [projectId, setProjectId] = useState(transaction?.project_id || '');
  const [tags, setTags] = useState<string[]>(transaction?.tags || []);
  // Wiederkehrende Ausgabe (Abo, Miete): Grundlage fuer Fixkosten und Liquiditaet im Cockpit
  const [isRecurring, setIsRecurring] = useState(transaction?.is_recurring ?? false);
  const [interval, setRecurrenceInterval] = useState<RecurrenceInterval>(transaction?.recurrence_interval ?? 'monatlich');
  const [tagInput, setTagInput] = useState('');
  // Weitere Angaben offen, wenn die Buchung dort schon etwas enthaelt
  const [moreOpen, setMoreOpen] = useState(
    !!(transaction?.customer_id || transaction?.project_id || transaction?.tags?.length)
  );
  const [loading, setLoading] = useState(false);

  // Receipt upload state
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [existingReceiptUrl, setExistingReceiptUrl] = useState<string | null>(transaction?.receipt_url || null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  // Fetch categories from database
  useEffect(() => {
    const fetchCategories = async () => {
      if (!selectedCompany) return;

      try {
        setIsLoadingCategories(true);
        // Auch inaktive Kategorien laden: Sie werden nicht zur Auswahl angeboten,
        // aber eine bestehende Buchung mit inaktiver Kategorie behaelt sie.
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .eq('company_id', selectedCompany.id)
          .order('sort_order', { ascending: true });

        if (error) throw error;
        setCategories(data || []);

        // Default nur beim Neuanlegen, nie beim Bearbeiten
        if (!transaction) {
          setCategoryName((current) => current || defaultCategoryName(data || [], activeTab));
        }
      } catch (err) {
        console.error('Error fetching categories:', err);
      } finally {
        setIsLoadingCategories(false);
      }
    };

    fetchCategories();
  }, [selectedCompany]);

  // Auswahlliste: aktive Kategorien plus ggf. die gespeicherte (inaktive) Kategorie
  const categoryOptions = buildCategoryOptions(categories, transaction?.category);
  const incomeOptions = categoryOptions.filter((o) => o.type === 'income');
  const expenseOptions = categoryOptions.filter((o) => o.type === 'expense');
  const otherOptions = categoryOptions.filter((o) => o.type === null);

  // Kategorie gewaehlt: Typ passend nachziehen
  const handleCategoryChange = (newName: string) => {
    setCategoryName(newName);
    const option = categoryOptions.find((o) => o.value === newName);
    if (option?.type) {
      setActiveTab(transactionTypeFor(option.type));
    }
  };

  // Typ gewechselt: Passt die gewaehlte Kategorie nicht mehr zum Typ, die erste
  // Kategorie des neuen Typs vorschlagen (bewusste Aktion des Benutzers).
  const handleTabChange = (newTab: 'einnahme' | 'ausgabe') => {
    setActiveTab(newTab);
    const option = categoryOptions.find((o) => o.value === categoryName);
    if (option?.type && transactionTypeFor(option.type) === newTab) return;
    setCategoryName(defaultCategoryName(categories, newTab));
  };

  // Removed auto-generation logic (Phase 3.4)
  // Transaction numbers are now auto-generated by database trigger
  // See migration: 20260215_transaction_auto_increment.sql

  const handleSubmit = async (e: React.FormEvent, saveAndNew = false) => {
    e.preventDefault();
    // Textfeld statt type=number: Komma und Tausender-Apostroph sind erlaubt
    const parsedAmount = parseNumber(amount);
    if (parsedAmount === null || parsedAmount <= 0) {
      toast.error('Bitte einen Betrag grösser als 0 eingeben.');
      return;
    }
    setLoading(true);

    try {
      // Upload receipt if a new file was selected
      let receiptUrl = existingReceiptUrl;
      if (receiptFile) {
        receiptUrl = await uploadReceipt();
      }

      await onSubmit({
        type: activeTab,
        transaction_number: transactionNumber || null, // Let DB trigger generate if empty
        date,
        amount: roundRappen(parsedAmount),
        category: emptyToNull(categoryName),
        description: emptyToNull(description),
        counterparty: emptyToNull(counterparty),
        customer_id: customerId || null,
        project_id: projectId || null,
        tags: tags.length > 0 ? tags : null,
        receipt_url: receiptUrl,
        is_recurring: activeTab === 'ausgabe' && isRecurring,
        recurrence_interval: activeTab === 'ausgabe' && isRecurring ? interval : null,
      });

      if (saveAndNew) {
        // Reset form - keep current type and select first category of that type
        setTransactionNumber('');
        setAmount('');
        setDescription('');
        setCounterparty('');
        setCategoryName(defaultCategoryName(categories, activeTab));
        setCustomerId('');
        setProjectId('');
        setTags([]);
        setReceiptFile(null);
        setExistingReceiptUrl(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        onCancel();
      }
    } catch (error) {
      console.error('Error saving transaction:', error);
    } finally {
      setLoading(false);
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  // Receipt file handling
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Wähl eine PDF- oder Bilddatei (JPG, PNG, WebP).');
        return;
      }
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Die Datei darf maximal 10 MB gross sein.');
        return;
      }
      setReceiptFile(file);
      setExistingReceiptUrl(null); // Clear existing URL when new file selected
    }
  };

  const removeReceipt = () => {
    setReceiptFile(null);
    setExistingReceiptUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadReceipt = async (): Promise<string | null> => {
    if (!receiptFile || !user) return existingReceiptUrl;

    setUploadingReceipt(true);
    try {
      const timestamp = Date.now();
      const sanitizedFileName = receiptFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${user.id}/${timestamp}_${sanitizedFileName}`;

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, receiptFile);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      // Return file path only (not public URL) - use signed URLs for access
      return filePath;
    } catch (error) {
      console.error('Error uploading receipt:', error);
      toast.error('Fehler beim Hochladen des Belegs.');
      return existingReceiptUrl;
    } finally {
      setUploadingReceipt(false);
    }
  };

  const getFileIcon = () => {
    if (!receiptFile) return null;
    return receiptFile.type === 'application/pdf' ? (
      <FileText className="h-5 w-5 text-fg-muted" aria-hidden="true" />
    ) : (
      <Image className="h-5 w-5 text-fg-muted" aria-hidden="true" />
    );
  };

  const openReceipt = async () => {
    if (!existingReceiptUrl) return;
    const { data, error } = await supabase.storage.from('receipts').createSignedUrl(existingReceiptUrl, 60);
    if (error) {
      console.error('Error creating signed URL:', error);
      toast.error('Fehler beim Öffnen des Belegs.');
      return;
    }
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  // Formular ohne eigenes Overlay: Es steht im Modal der Seite Buchungen
  // (vorher oeffnete es ein zweites Overlay ueber dem Modal).
  return (
    <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-5">
      {/* Typ */}
      <div role="group" aria-label="Art der Buchung" className="toggle-group">
        {(['ausgabe', 'einnahme'] as const).map((type) => (
          <button
            key={type}
            type="button"
            aria-pressed={activeTab === type}
            onClick={() => handleTabChange(type)}
            className={`rounded-md px-4 py-1.5 font-display text-sm font-bold transition-colors ${
              activeTab === type ? 'toggle-on' : 'toggle-off'
            }`}
          >
            {type === 'ausgabe' ? 'Ausgabe' : 'Einnahme'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="transaction-date" className="label">
            Datum
          </label>
          <input id="transaction-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" required />
        </div>
        <div>
          <label htmlFor="transaction-amount" className="label">
            Betrag (CHF)
          </label>
          <input
            id="transaction-amount"
            type="text"
            inputMode="decimal"
            enterKeyHint="next"
            autoComplete="off"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input text-right"
            required
          />
        </div>
        <div>
          <label htmlFor="transaction-category" className="label">
            Kategorie
          </label>
          <select
            id="transaction-category"
            value={categoryName}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="input"
            disabled={isLoadingCategories}
          >
            {isLoadingCategories ? (
              <option value="">Lädt …</option>
            ) : categoryOptions.length === 0 ? (
              <option value="">Keine Kategorien verfügbar</option>
            ) : (
              <>
                <option value="">Ohne Kategorie</option>
                {incomeOptions.length > 0 && (
                  <optgroup label="Einnahmen">
                    {incomeOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </optgroup>
                )}
                {expenseOptions.length > 0 && (
                  <optgroup label="Ausgaben">
                    {expenseOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </optgroup>
                )}
                {otherOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>
        <div>
          <label htmlFor="transaction-counterparty" className="label">
            {activeTab === 'ausgabe' ? 'Lieferant' : 'Zahler'}
          </label>
          <input
            id="transaction-counterparty"
            type="text"
            list="transaction-counterparty-suggestions"
            autoComplete="off"
            value={counterparty}
            onChange={(e) => setCounterparty(e.target.value)}
            className="input"
            placeholder={activeTab === 'ausgabe' ? 'z.B. Infomaniak' : 'z. B. Muster AG'}
          />
          <datalist id="transaction-counterparty-suggestions">
            {counterpartySuggestions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>
      </div>

      {activeTab === 'ausgabe' && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-fg">
            <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--bw-fg))]" />
            Wiederkehrend (Abo, Miete, Versicherung)
          </label>
          {isRecurring && (
            <select aria-label="Intervall" value={interval} onChange={(e) => setRecurrenceInterval(e.target.value as RecurrenceInterval)} className="input w-auto py-1.5">
              <option value="monatlich">monatlich</option>
              <option value="quartalsweise">quartalsweise</option>
              <option value="jaehrlich">jährlich</option>
            </select>
          )}
        </div>
      )}

      <div>
        <label htmlFor="transaction-description" className="label">
          Beschreibung
        </label>
        <textarea
          id="transaction-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="input"
          placeholder="Details zur Buchung"
        />
      </div>

      {/* Beleg: Datei waehlen oder auf dem Handy direkt fotografieren */}
      <div>
        <span id="receipt-label" className="label">
          Beleg
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
          onChange={handleFileSelect}
          className="sr-only"
          id="receipt-upload"
          aria-labelledby="receipt-label"
        />
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="sr-only"
          id="receipt-camera"
          aria-label="Beleg fotografieren"
        />
        {!receiptFile && !existingReceiptUrl ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <label
              htmlFor="receipt-camera"
              className="btn-secondary cursor-pointer sm:hidden"
            >
              <Camera className="h-4 w-4" aria-hidden="true" /> Foto aufnehmen
            </label>
            <label
              htmlFor="receipt-upload"
              className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong px-4 py-3 text-sm text-fg-muted hover:bg-canvas"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              PDF oder Bild wählen (max. 10 MB)
            </label>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-canvas px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              {receiptFile ? (
                <>
                  {getFileIcon()}
                  <span className="truncate text-sm text-fg">{receiptFile.name}</span>
                  <span className="text-xs text-fg-muted">({(receiptFile.size / 1024).toFixed(0)} KB)</span>
                </>
              ) : (
                <>
                  <Paperclip className="h-4 w-4 text-fg-muted" aria-hidden="true" />
                  <button type="button" onClick={openReceipt} className="bw-textlink text-sm">
                    Beleg anzeigen
                  </button>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={removeReceipt}
              className="rounded-lg p-1.5 text-fg-muted hover:bg-raised hover:text-danger"
              aria-label="Beleg entfernen"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
        {uploadingReceipt && <p className="mt-1 text-sm text-fg-muted">Beleg wird hochgeladen …</p>}
      </div>

      <details
        open={moreOpen}
        onToggle={(e) => setMoreOpen((e.currentTarget as HTMLDetailsElement).open)}
        className="group rounded-lg border border-line px-4 py-2 [&_summary::-webkit-details-marker]:hidden">
        <summary className="cursor-pointer list-none py-1 text-sm font-semibold text-fg">
          Weitere Angaben <span className="font-normal text-fg-muted">(Beleg-Nr, Firma, Projekt, Tags)</span>
        </summary>
        <div className="mt-3 grid grid-cols-1 gap-4 pb-2 sm:grid-cols-2">
          <div>
            <label htmlFor="transaction-number" className="label">
              Beleg-Nr {!transaction && <span className="font-normal text-fg-muted">(automatisch)</span>}
            </label>
            <input
              id="transaction-number"
              type="text"
              value={transactionNumber}
              onChange={(e) => setTransactionNumber(e.target.value)}
              className="input"
              placeholder="Automatisch"
              disabled={!transaction}
            />
          </div>
          <div>
            <label htmlFor="transaction-customer" className="label">
              Kunde
            </label>
            <select id="transaction-customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="input">
              <option value="">Keine Auswahl</option>
              {customers.filter((c) => !c.is_supplier || c.id === customerId).map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="transaction-project" className="label">
              Projekt
            </label>
            <select id="transaction-project" value={projectId} onChange={(e) => setProjectId(e.target.value)} className="input">
              <option value="">Keine Auswahl</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="transaction-tag" className="label">
              Tags
            </label>
            <div className="flex gap-2">
              <input
                id="transaction-tag"
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
                className="input"
                placeholder="Tag eingeben"
              />
              <button type="button" onClick={addTag} className="btn-secondary">
                Hinzufügen
              </button>
            </div>
            {tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span key={tag} className="badge-neutral gap-1">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} aria-label={`Tag ${tag} entfernen`} className="hover:text-danger">
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </details>

      {/* Handy: eine Zeile in der festen Fussleiste; Abbrechen ueber das X oben */}
      <div className="sheet-actions flex gap-2 border-t border-line pt-4 sm:justify-end">
        <button type="button" onClick={onCancel} className="btn-ghost max-sm:hidden" disabled={loading}>
          Abbrechen
        </button>
        {!transaction && (
          <button type="button" onClick={(e) => handleSubmit(e, true)} className="btn-secondary max-sm:flex-1" disabled={loading}>
            <span className="sm:hidden">Speichern und nächste</span>
            <span className="max-sm:hidden">Speichern und neue Buchung</span>
          </button>
        )}
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Speichern …' : 'Speichern'}
        </button>
      </div>
    </form>
  );
}
