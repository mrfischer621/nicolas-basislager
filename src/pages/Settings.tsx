import { useState, useEffect } from 'react';
import { useConfirm } from '../context/ConfirmProvider';
import { supabase } from '../lib/supabase';
import type { PipelineStage, Category, CategoryType } from '../lib/supabase';
import { useCompany } from '../context/CompanyContext';
import { useAuth } from '../context/AuthProvider';
import { Building2, Save, AlertCircle, CheckCircle, TrendingUp, Edit2, Check, X, Trash2, Plus, User, FileText, Tags, ArrowDownCircle, ArrowUpCircle, Package } from 'lucide-react';

interface CompanyFormData {
  name: string;
  alternativ_name: string; // Alternative company name / "Doing Business As"
  rechnungsname: string; // Display name for invoices and quotes
  logo_url: string; // Company logo URL for PDF header
  phone: string; // Shown in PDF footer
  email: string; // Shown in PDF footer
  website: string; // Shown in PDF footer
  street: string;
  house_number: string;
  zip_code: string;
  city: string;
  iban: string;
  qr_iban: string;
  qr_creditor_name: string; // Personal name for QR-Bill creditor (e.g., "Nicolas Fischer")
  uid_number: string;
  bank_name: string;
  vat_number: string;
  vat_enabled: boolean;
  default_vat_rate: string; // Store as string in form, convert to number on submit
  sender_contact_name: string; // Phase 3.3: Optional contact name for invoice sender
}

interface Toast {
  type: 'success' | 'error';
  message: string;
}

type TabType = 'company' | 'profile' | 'templates' | 'pipeline' | 'categories' | 'product_categories';

export default function Settings() {
  const confirmDialog = useConfirm();
  const { selectedCompany, refreshCompanies } = useCompany();
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('company');

  // Company settings state
  const [companyFormData, setCompanyFormData] = useState<CompanyFormData>({
    name: '',
    alternativ_name: '',
    rechnungsname: '',
    logo_url: '',
    phone: '',
    email: '',
    website: '',
    street: '',
    house_number: '',
    zip_code: '',
    city: '',
    iban: '',
    qr_iban: '',
    qr_creditor_name: '',
    uid_number: '',
    bank_name: '',
    vat_number: '',
    vat_enabled: false,
    default_vat_rate: '8.1',
    sender_contact_name: '',
  });

  // User profile state
  const [fullName, setFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Text templates state (placeholder for Phase 3.6)
  const [invoiceIntro, setInvoiceIntro] = useState('');
  const [invoiceFooter, setInvoiceFooter] = useState('');
  const [quoteIntro, setQuoteIntro] = useState('');
  const [quoteFooter, setQuoteFooter] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Pipeline settings state
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editStageName, setEditStageName] = useState('');
  const [editStageColor, setEditStageColor] = useState('');
  const [isLoadingStages, setIsLoadingStages] = useState(false);

  // Categories (Buchungskategorien) state
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryTypeFilter, setCategoryTypeFilter] = useState<CategoryType | 'all'>('all');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState<CategoryType>('expense');
  const [newCategoryColor, setNewCategoryColor] = useState('#6B7280');
  const [newCategoryTaxRelevant, setNewCategoryTaxRelevant] = useState(true);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editCategoryColor, setEditCategoryColor] = useState('');
  const [editCategoryTaxRelevant, setEditCategoryTaxRelevant] = useState(true);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);

  // Product Categories state (Phase 3.2)
  const [productCategories, setProductCategories] = useState<string[]>([]);
  const [newProductCategory, setNewProductCategory] = useState('');
  const [editingProductCategoryIndex, setEditingProductCategoryIndex] = useState<number | null>(null);
  const [editProductCategoryValue, setEditProductCategoryValue] = useState('');

  // Load company data
  useEffect(() => {
    if (selectedCompany) {
      setCompanyFormData({
        name: selectedCompany.name || '',
        alternativ_name: selectedCompany.alternativ_name || '',
        rechnungsname: selectedCompany.rechnungsname || '',
        logo_url: selectedCompany.logo_url || '',
        phone: selectedCompany.phone || '',
        email: selectedCompany.email || '',
        website: selectedCompany.website || '',
        street: selectedCompany.street || '',
        house_number: selectedCompany.house_number || '',
        zip_code: selectedCompany.zip_code || '',
        city: selectedCompany.city || '',
        iban: selectedCompany.iban || '',
        qr_iban: selectedCompany.qr_iban || '',
        qr_creditor_name: selectedCompany.qr_creditor_name || '',
        uid_number: selectedCompany.uid_number || '',
        bank_name: selectedCompany.bank_name || '',
        vat_number: selectedCompany.vat_number || '',
        vat_enabled: selectedCompany.vat_enabled || false,
        default_vat_rate: selectedCompany.default_vat_rate?.toString() || '8.1',
        sender_contact_name: selectedCompany.sender_contact_name || '',
      });
      // Load text templates
      setInvoiceIntro(selectedCompany.invoice_intro_text || '');
      setInvoiceFooter(selectedCompany.invoice_footer_text || '');
      setQuoteIntro(selectedCompany.quote_intro_text || '');
      setQuoteFooter(selectedCompany.quote_footer_text || '');
      // Load product categories (Phase 3.2) - with safety check
      setProductCategories(selectedCompany?.product_categories || []);
    }
  }, [selectedCompany]);

  // Load user profile data
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
    }
  }, [profile]);

  // Load pipeline stages when pipeline tab is active
  useEffect(() => {
    if (activeTab === 'pipeline' && selectedCompany) {
      fetchStages();
    }
  }, [activeTab, selectedCompany]);

  // Load categories when categories tab is active
  useEffect(() => {
    if (activeTab === 'categories' && selectedCompany) {
      fetchCategories();
    }
  }, [activeTab, selectedCompany]);

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  if (!selectedCompany || !profile) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Lädt...</p>
      </div>
    );
  }

  const fetchStages = async () => {
    if (!selectedCompany) return;

    try {
      setIsLoadingStages(true);
      const { data, error } = await supabase
        .from('pipeline_stages')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .order('position', { ascending: true });

      if (error) throw error;
      setStages(data || []);
    } catch (err) {
      console.error('Error fetching stages:', err);
      showToast('error', 'Fehler beim Laden der Pipeline-Phasen.');
    } finally {
      setIsLoadingStages(false);
    }
  };

  const fetchCategories = async () => {
    if (!selectedCompany) return;

    try {
      setIsLoadingCategories(true);
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .eq('is_active', true)
        .order('type', { ascending: true })
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
      showToast('error', 'Fehler beim Laden der Kategorien.');
    } finally {
      setIsLoadingCategories(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim() || !selectedCompany) return;

    try {
      setIsLoadingCategories(true);
      const sameTypeCategories = categories.filter(c => c.type === newCategoryType);
      const maxSortOrder = Math.max(0, ...sameTypeCategories.map(c => c.sort_order));

      const { data, error } = await supabase
        .from('categories')
        .insert({
          company_id: selectedCompany.id,
          name: newCategoryName.trim(),
          type: newCategoryType,
          color: newCategoryColor,
          is_tax_relevant: newCategoryTaxRelevant,
          sort_order: maxSortOrder + 1,
        })
        .select()
        .single();

      if (error) throw error;

      setCategories([...categories, data]);
      setNewCategoryName('');
      setNewCategoryColor('#6B7280');
      setNewCategoryTaxRelevant(true);
      showToast('success', 'Kategorie hinzugefügt.');
    } catch (err) {
      console.error('Error adding category:', err);
      showToast('error', 'Fehler beim Hinzufügen der Kategorie.');
    } finally {
      setIsLoadingCategories(false);
    }
  };

  const handleUpdateCategory = async (categoryId: string) => {
    if (!editCategoryName.trim()) return;

    try {
      const { error } = await supabase
        .from('categories')
        .update({
          name: editCategoryName.trim(),
          color: editCategoryColor,
          is_tax_relevant: editCategoryTaxRelevant,
        })
        .eq('id', categoryId);

      if (error) throw error;

      setCategories(categories.map(c =>
        c.id === categoryId
          ? { ...c, name: editCategoryName.trim(), color: editCategoryColor, is_tax_relevant: editCategoryTaxRelevant }
          : c
      ));
      setEditingCategoryId(null);
      setEditCategoryName('');
      showToast('success', 'Kategorie aktualisiert.');
    } catch (err) {
      console.error('Error updating category:', err);
      showToast('error', 'Fehler beim Aktualisieren der Kategorie.');
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!(await confirmDialog({ title: 'Kategorie deaktivieren', confirmLabel: 'Deaktivieren', message: 'Möchten Sie diese Kategorie wirklich deaktivieren?', destructive: true }))) return;

    try {
      // Soft delete - set is_active to false
      const { error } = await supabase
        .from('categories')
        .update({ is_active: false })
        .eq('id', categoryId);

      if (error) throw error;

      setCategories(categories.filter(c => c.id !== categoryId));
      showToast('success', 'Kategorie deaktiviert.');
    } catch (err) {
      console.error('Error deleting category:', err);
      showToast('error', 'Fehler beim Deaktivieren der Kategorie.');
    }
  };

  const startEditCategory = (category: Category) => {
    setEditingCategoryId(category.id);
    setEditCategoryName(category.name);
    setEditCategoryColor(category.color);
    setEditCategoryTaxRelevant(category.is_tax_relevant);
  };

  const cancelEditCategory = () => {
    setEditingCategoryId(null);
    setEditCategoryName('');
    setEditCategoryColor('');
    setEditCategoryTaxRelevant(true);
  };

  const filteredCategories = categoryTypeFilter === 'all'
    ? categories
    : categories.filter(c => c.type === categoryTypeFilter);

  const validateCompanyForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!companyFormData.name.trim()) {
      newErrors.name = 'Firmenname ist erforderlich';
    }
    if (!companyFormData.street.trim()) {
      newErrors.street = 'Strasse ist erforderlich';
    }
    if (!companyFormData.house_number.trim()) {
      newErrors.house_number = 'Hausnummer ist erforderlich';
    }
    if (!companyFormData.zip_code.trim()) {
      newErrors.zip_code = 'PLZ ist erforderlich';
    }
    if (!companyFormData.city.trim()) {
      newErrors.city = 'Ort ist erforderlich';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
  };

  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateCompanyForm()) {
      showToast('error', 'Bitte füllen Sie alle Pflichtfelder aus.');
      return;
    }

    setIsSaving(true);

    try {
      // Convert default_vat_rate from string to number
      const updateData = {
        ...companyFormData,
        default_vat_rate: parseFloat(companyFormData.default_vat_rate) || 8.1,
      };

      const { error } = await supabase
        .from('companies')
        .update(updateData)
        .eq('id', selectedCompany.id);

      if (error) throw error;

      // Refresh company data in context to reflect changes
      await refreshCompanies();

      showToast('success', 'Firmeneinstellungen erfolgreich gespeichert!');
    } catch (err) {
      console.error('Error saving company settings:', err);
      showToast('error', 'Fehler beim Speichern der Firmeneinstellungen.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCompanyFieldChange = (field: keyof CompanyFormData, value: string | boolean) => {
    setCompanyFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      // Update full_name in profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim() || null })
        .eq('id', user!.id);

      if (profileError) throw profileError;

      // Update password if provided
      if (newPassword || confirmPassword) {
        if (newPassword !== confirmPassword) {
          showToast('error', 'Passwörter stimmen nicht überein.');
          return;
        }

        if (newPassword.length < 6) {
          showToast('error', 'Passwort muss mindestens 6 Zeichen lang sein.');
          return;
        }

        const { error: passwordError } = await supabase.auth.updateUser({
          password: newPassword,
        });

        if (passwordError) throw passwordError;

        setNewPassword('');
        setConfirmPassword('');
        showToast('success', 'Benutzerprofil und Passwort erfolgreich aktualisiert!');
      } else {
        showToast('success', 'Benutzerprofil erfolgreich aktualisiert!');
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      showToast('error', 'Fehler beim Aktualisieren des Profils.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTemplatesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const { data, error } = await supabase
        .from('companies')
        .update({
          invoice_intro_text: invoiceIntro.trim() || null,
          invoice_footer_text: invoiceFooter.trim() || null,
          quote_intro_text: quoteIntro.trim() || null,
          quote_footer_text: quoteFooter.trim() || null,
        })
        .eq('id', selectedCompany.id)
        .select()
        .single();

      if (error) throw error;

      // Update local state with returned data to ensure consistency
      if (data) {
        setInvoiceIntro(data.invoice_intro_text || '');
        setInvoiceFooter(data.invoice_footer_text || '');
        setQuoteIntro(data.quote_intro_text || '');
        setQuoteFooter(data.quote_footer_text || '');
      }

      showToast('success', 'Textvorlagen erfolgreich gespeichert!');
    } catch (err) {
      console.error('Error saving text templates:', err);
      showToast('error', 'Fehler beim Speichern der Textvorlagen.');
    } finally {
      setIsSaving(false);
    }
  };

  // Pipeline stage handlers
  const handleEditStage = (stage: PipelineStage) => {
    setEditingStageId(stage.id);
    setEditStageName(stage.name);
    setEditStageColor(stage.color);
  };

  const handleSaveStage = async (stageId: string) => {
    if (!editStageName.trim()) {
      showToast('error', 'Phasenname darf nicht leer sein.');
      return;
    }

    try {
      const { error } = await supabase
        .from('pipeline_stages')
        .update({
          name: editStageName.trim(),
          color: editStageColor
        })
        .eq('id', stageId);

      if (error) throw error;

      setStages(stages.map(s =>
        s.id === stageId
          ? { ...s, name: editStageName.trim(), color: editStageColor }
          : s
      ));
      setEditingStageId(null);
      showToast('success', 'Phase erfolgreich aktualisiert.');
    } catch (err) {
      console.error('Error updating stage:', err);
      showToast('error', 'Fehler beim Aktualisieren der Phase.');
    }
  };

  const handleCancelEdit = () => {
    setEditingStageId(null);
    setEditStageName('');
    setEditStageColor('');
  };

  const handleDeleteStage = async (stage: PipelineStage) => {
    const { data: opportunities, error: checkError } = await supabase
      .from('opportunities')
      .select('id')
      .eq('stage_id', stage.id)
      .limit(1);

    if (checkError) {
      showToast('error', 'Fehler beim Prüfen der Phase.');
      return;
    }

    if (opportunities && opportunities.length > 0) {
      showToast('error', 'Diese Phase enthält noch Deals. Bitte verschieben Sie diese zuerst.');
      return;
    }

    if (!(await confirmDialog({ title: 'Phase löschen', confirmLabel: 'Löschen', message: `Möchten Sie die Phase "${stage.name}" wirklich löschen?`, destructive: true }))) {
      return;
    }

    try {
      const { error } = await supabase
        .from('pipeline_stages')
        .delete()
        .eq('id', stage.id);

      if (error) throw error;

      await fetchStages();
      showToast('success', 'Phase erfolgreich gelöscht.');
    } catch (err) {
      console.error('Error deleting stage:', err);
      showToast('error', 'Fehler beim Löschen der Phase.');
    }
  };

  const handleAddStage = async () => {
    const stageName = prompt('Name der neuen Phase:');
    if (!stageName || !stageName.trim()) return;

    try {
      const maxPosition = stages.length > 0 ? Math.max(...stages.map(s => s.position)) : -1;

      const { error } = await supabase
        .from('pipeline_stages')
        .insert([{
          company_id: selectedCompany.id,
          name: stageName.trim(),
          position: maxPosition + 1,
          color: '#6B7280',
        }] as any);

      if (error) throw error;

      await fetchStages();
      showToast('success', 'Phase erfolgreich hinzugefügt.');
    } catch (err) {
      console.error('Error adding stage:', err);
      showToast('error', 'Fehler beim Hinzufügen der Phase.');
    }
  };

  // Product Categories handlers (Phase 3.2)
  const handleAddProductCategory = async () => {
    if (!newProductCategory.trim() || !selectedCompany) return;

    const trimmed = newProductCategory.trim();
    if (productCategories.includes(trimmed)) {
      showToast('error', 'Diese Kategorie existiert bereits.');
      return;
    }

    try {
      const updatedCategories = [...productCategories, trimmed];
      console.log('[ProductCategories] Adding category:', trimmed);
      console.log('[ProductCategories] Current categories:', productCategories);
      console.log('[ProductCategories] Updated categories:', updatedCategories);
      console.log('[ProductCategories] Company ID:', selectedCompany.id);

      const { data, error } = await supabase
        .from('companies')
        .update({ product_categories: updatedCategories })
        .eq('id', selectedCompany.id)
        .select();

      console.log('[ProductCategories] Update response:', { data, error });

      if (error) throw error;

      setProductCategories(updatedCategories);
      setNewProductCategory('');

      // Refresh company data to reflect changes
      await refreshCompanies();

      showToast('success', 'Produktkategorie hinzugefügt.');
    } catch (err) {
      console.error('[ProductCategories] Error adding category:', err);
      showToast('error', 'Fehler beim Hinzufügen der Produktkategorie.');
    }
  };

  const handleUpdateProductCategory = async (index: number) => {
    if (!editProductCategoryValue.trim()) return;

    const trimmed = editProductCategoryValue.trim();
    if (productCategories.includes(trimmed) && productCategories[index] !== trimmed) {
      showToast('error', 'Diese Kategorie existiert bereits.');
      return;
    }

    try {
      const updatedCategories = [...productCategories];
      updatedCategories[index] = trimmed;

      console.log('[ProductCategories] Updating category at index', index);
      console.log('[ProductCategories] Updated categories:', updatedCategories);

      const { data, error } = await supabase
        .from('companies')
        .update({ product_categories: updatedCategories })
        .eq('id', selectedCompany!.id)
        .select();

      console.log('[ProductCategories] Update response:', { data, error });

      if (error) throw error;

      setProductCategories(updatedCategories);
      setEditingProductCategoryIndex(null);
      setEditProductCategoryValue('');

      // Refresh company data to reflect changes
      await refreshCompanies();

      showToast('success', 'Produktkategorie aktualisiert.');
    } catch (err) {
      console.error('[ProductCategories] Error updating category:', err);
      showToast('error', 'Fehler beim Aktualisieren der Produktkategorie.');
    }
  };

  const handleDeleteProductCategory = async (index: number) => {
    if (!(await confirmDialog({ title: 'Produktkategorie löschen', confirmLabel: 'Löschen', message: 'Möchten Sie diese Produktkategorie wirklich löschen?', destructive: true }))) return;

    try {
      const updatedCategories = productCategories.filter((_, i) => i !== index);

      console.log('[ProductCategories] Deleting category at index', index);
      console.log('[ProductCategories] Updated categories after delete:', updatedCategories);

      const { data, error } = await supabase
        .from('companies')
        .update({ product_categories: updatedCategories })
        .eq('id', selectedCompany!.id)
        .select();

      console.log('[ProductCategories] Delete response:', { data, error });

      if (error) throw error;

      setProductCategories(updatedCategories);

      // Refresh company data to reflect changes
      await refreshCompanies();

      showToast('success', 'Produktkategorie gelöscht.');
    } catch (err) {
      console.error('[ProductCategories] Error deleting category:', err);
      showToast('error', 'Fehler beim Löschen der Produktkategorie.');
    }
  };

  const startEditProductCategory = (index: number) => {
    setEditingProductCategoryIndex(index);
    setEditProductCategoryValue(productCategories[index]);
  };

  const cancelEditProductCategory = () => {
    setEditingProductCategoryIndex(null);
    setEditProductCategoryValue('');
  };

  const tabs = [
    { id: 'company' as TabType, label: 'Firmenprofil', icon: Building2 },
    { id: 'profile' as TabType, label: 'Benutzerprofil', icon: User },
    { id: 'templates' as TabType, label: 'Textvorlagen', icon: FileText },
    { id: 'categories' as TabType, label: 'Buchungskategorien', icon: Tags },
    { id: 'product_categories' as TabType, label: 'Produktkategorien', icon: Package },
    { id: 'pipeline' as TabType, label: 'Sales Pipeline', icon: TrendingUp },
  ];

  const colorOptions = [
    { value: '#6B7280', label: 'Grau' },
    { value: '#3B82F6', label: 'Blau' },
    { value: '#8B5CF6', label: 'Lila' },
    { value: '#F59E0B', label: 'Gelb' },
    { value: '#EF4444', label: 'Rot' },
    { value: '#10B981', label: 'Grün' },
    { value: '#EC4899', label: 'Pink' },
    { value: '#14B8A6', label: 'Türkis' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Einstellungen</h1>
        <p className="text-gray-600 mt-1">Verwalten Sie Ihre Firmen- und Benutzereinstellungen</p>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          className={`flex items-center gap-3 p-4 rounded-lg ${
            toast.type === 'success'
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle className="text-green-600 flex-shrink-0" size={20} />
          ) : (
            <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
          )}
          <p className={toast.type === 'success' ? 'text-green-800' : 'text-red-800'}>
            {toast.message}
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 px-1 border-b-2 font-medium text-sm transition flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-brand text-brand'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content: Company Profile */}
      {activeTab === 'company' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <form onSubmit={handleCompanySubmit} className="space-y-6">
            {/* Company Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Firmenname <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                value={companyFormData.name}
                onChange={(e) => handleCompanyFieldChange('name', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition ${
                  errors.name ? 'border-red-500' : 'border-gray-200'
                }`}
                placeholder="z.B. Muster AG"
              />
              {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name}</p>}
            </div>

            {/* Alternative Company Name */}
            <div>
              <label htmlFor="alternativ_name" className="block text-sm font-medium text-gray-700 mb-1">
                Alternativer Firmenname <span className="text-xs font-normal text-gray-500">(optional)</span>
              </label>
              <input
                type="text"
                id="alternativ_name"
                value={companyFormData.alternativ_name}
                onChange={(e) => handleCompanyFieldChange('alternativ_name', e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
                placeholder="z.B. Handelsname oder Doing Business As"
              />
              <p className="text-xs text-gray-500 mt-1">
                Alternative Firmenbezeichnung (z.B. Geschäftsname unter dem Sie auftreten)
              </p>
            </div>

            {/* Invoice Display Name */}
            <div>
              <label htmlFor="rechnungsname" className="block text-sm font-medium text-gray-700 mb-1">
                Rechnungsname <span className="text-xs font-normal text-gray-500">(optional)</span>
              </label>
              <input
                type="text"
                id="rechnungsname"
                value={companyFormData.rechnungsname}
                onChange={(e) => handleCompanyFieldChange('rechnungsname', e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
                placeholder="z.B. spezieller Name für Rechnungen"
              />
              <p className="text-xs text-gray-500 mt-1">
                Name, der auf Rechnungen und Offerten erscheint (falls abweichend vom offiziellen Firmennamen)
              </p>
            </div>

            {/* Company Logo URL */}
            <div>
              <label htmlFor="logo_url" className="block text-sm font-medium text-gray-700 mb-1">
                Firmenlogo-URL <span className="text-xs font-normal text-gray-500">(optional, erscheint oben rechts auf PDF-Offerten)</span>
              </label>
              <input
                type="url"
                id="logo_url"
                value={companyFormData.logo_url}
                onChange={(e) => handleCompanyFieldChange('logo_url', e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
                placeholder="https://beispiel.ch/logo.png"
              />
              {companyFormData.logo_url && (
                <div className="mt-2 flex items-center gap-3">
                  <img
                    src={companyFormData.logo_url}
                    alt="Firmenlogo Vorschau"
                    className="h-12 w-auto object-contain border border-gray-200 rounded p-1 bg-white"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                  <span className="text-xs text-gray-500">Vorschau</span>
                </div>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Direkter Link zu einem öffentlich erreichbaren Bild (PNG, JPG, SVG). Empfohlene Grösse: quadratisch, min. 200×200 px.
              </p>
            </div>

            {/* Sender Contact Name (Phase 3.3) */}
            <div>
              <label htmlFor="sender_contact_name" className="block text-sm font-medium text-gray-700 mb-1">
                Kontaktperson / Inhaber <span className="text-xs font-normal text-gray-500">(optional, erscheint auf Rechnungen)</span>
              </label>
              <input
                type="text"
                id="sender_contact_name"
                value={companyFormData.sender_contact_name}
                onChange={(e) => handleCompanyFieldChange('sender_contact_name', e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
                placeholder="z.B. c/o Hans Muster oder Inhaber: Maria Müller"
              />
              <p className="text-xs text-gray-500 mt-1">
                Wenn ausgefüllt, erscheint dieser Name oberhalb des Firmennamens auf PDF-Rechnungen und Offerten.
              </p>
            </div>

            {/* Address */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label htmlFor="street" className="block text-sm font-medium text-gray-700 mb-1">
                  Strasse <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="street"
                  value={companyFormData.street}
                  onChange={(e) => handleCompanyFieldChange('street', e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition ${
                    errors.street ? 'border-red-500' : 'border-gray-200'
                  }`}
                  placeholder="Musterstrasse"
                />
                {errors.street && <p className="text-sm text-red-600 mt-1">{errors.street}</p>}
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label htmlFor="house_number" className="block text-sm font-medium text-gray-700 mb-1">
                  Hausnummer <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="house_number"
                  value={companyFormData.house_number}
                  onChange={(e) => handleCompanyFieldChange('house_number', e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition ${
                    errors.house_number ? 'border-red-500' : 'border-gray-200'
                  }`}
                  placeholder="123"
                />
                {errors.house_number && (
                  <p className="text-sm text-red-600 mt-1">{errors.house_number}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label htmlFor="zip_code" className="block text-sm font-medium text-gray-700 mb-1">
                  PLZ <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="zip_code"
                  value={companyFormData.zip_code}
                  onChange={(e) => handleCompanyFieldChange('zip_code', e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition ${
                    errors.zip_code ? 'border-red-500' : 'border-gray-200'
                  }`}
                  placeholder="8000"
                />
                {errors.zip_code && <p className="text-sm text-red-600 mt-1">{errors.zip_code}</p>}
              </div>

              <div className="col-span-2">
                <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                  Ort <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="city"
                  value={companyFormData.city}
                  onChange={(e) => handleCompanyFieldChange('city', e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition ${
                    errors.city ? 'border-red-500' : 'border-gray-200'
                  }`}
                  placeholder="Zürich"
                />
                {errors.city && <p className="text-sm text-red-600 mt-1">{errors.city}</p>}
              </div>
            </div>

            {/* Contact Info (PDF footer) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="company_phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Telefon <span className="text-xs font-normal text-gray-500">(optional, erscheint im PDF-Footer)</span>
                </label>
                <input
                  type="tel"
                  id="company_phone"
                  value={companyFormData.phone}
                  onChange={(e) => handleCompanyFieldChange('phone', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
                  placeholder="+41 44 123 45 67"
                />
              </div>
              <div>
                <label htmlFor="company_email" className="block text-sm font-medium text-gray-700 mb-1">
                  E-Mail <span className="text-xs font-normal text-gray-500">(optional, erscheint im PDF-Footer)</span>
                </label>
                <input
                  type="email"
                  id="company_email"
                  value={companyFormData.email}
                  onChange={(e) => handleCompanyFieldChange('email', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
                  placeholder="info@firma.ch"
                />
              </div>
            </div>

            <div>
              <label htmlFor="company_website" className="block text-sm font-medium text-gray-700 mb-1">
                Website <span className="text-xs font-normal text-gray-500">(optional, erscheint im PDF-Footer)</span>
              </label>
              <input
                type="text"
                id="company_website"
                value={companyFormData.website}
                onChange={(e) => handleCompanyFieldChange('website', e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
                placeholder="www.firma.ch"
              />
            </div>

            {/* Banking */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="iban" className="block text-sm font-medium text-gray-700 mb-1">
                  IBAN
                </label>
                <input
                  type="text"
                  id="iban"
                  value={companyFormData.iban}
                  onChange={(e) => handleCompanyFieldChange('iban', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
                  placeholder="CH93 0000 0000 0000 0000 0"
                />
              </div>

              <div>
                <label htmlFor="qr_iban" className="block text-sm font-medium text-gray-700 mb-1">
                  QR-IBAN <span className="text-xs font-normal text-blue-600">(empfohlen)</span>
                </label>
                <input
                  type="text"
                  id="qr_iban"
                  value={companyFormData.qr_iban}
                  onChange={(e) => handleCompanyFieldChange('qr_iban', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
                  placeholder="CH44 3000 0000 0000 0000 0"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 -mt-2">
              QR-IBAN (beginnt mit CH..30xxx-31xxx) ermöglicht automatische Zahlungszuordnung via Referenznummer.
              Mindestens IBAN oder QR-IBAN ist für QR-Rechnungen erforderlich.
            </p>

            <div>
              <label htmlFor="bank_name" className="block text-sm font-medium text-gray-700 mb-1">
                Bankname
              </label>
              <input
                type="text"
                id="bank_name"
                value={companyFormData.bank_name}
                onChange={(e) => handleCompanyFieldChange('bank_name', e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
                placeholder="z.B. UBS AG"
              />
            </div>

            {/* QR-Bill Creditor Name */}
            <div>
              <label htmlFor="qr_creditor_name" className="block text-sm font-medium text-gray-700 mb-1">
                QR-Rechnung Empfänger
              </label>
              <input
                type="text"
                id="qr_creditor_name"
                value={companyFormData.qr_creditor_name}
                onChange={(e) => handleCompanyFieldChange('qr_creditor_name', e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
                placeholder="z.B. Nicolas Fischer"
              />
              <p className="text-xs text-gray-500 mt-1">
                Persönlicher Name für den QR-Code (Zahlungsempfänger). Leer lassen um Firmennamen zu verwenden.
              </p>
            </div>

            {/* Tax */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="uid_number" className="block text-sm font-medium text-gray-700 mb-1">
                  UID-Nummer
                </label>
                <input
                  type="text"
                  id="uid_number"
                  value={companyFormData.uid_number}
                  onChange={(e) => handleCompanyFieldChange('uid_number', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
                  placeholder="CHE-123.456.789"
                />
              </div>

              <div>
                <label htmlFor="vat_number" className="block text-sm font-medium text-gray-700 mb-1">
                  MWST-Nummer
                </label>
                <input
                  type="text"
                  id="vat_number"
                  value={companyFormData.vat_number}
                  onChange={(e) => handleCompanyFieldChange('vat_number', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
                  placeholder="CHE-123.456.789 MWST"
                />
              </div>
            </div>

            {/* VAT Configuration */}
            <div className="border-t border-gray-200 pt-6 mt-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">
                MWST-Konfiguration
              </h3>

              {/* VAT Enabled Toggle */}
              <div className="flex items-start mb-4">
                <input
                  type="checkbox"
                  id="vat_enabled"
                  checked={companyFormData.vat_enabled}
                  onChange={(e) => handleCompanyFieldChange('vat_enabled', e.target.checked)}
                  className="w-4 h-4 text-brand border-gray-300 rounded focus:ring-brand mt-1"
                />
                <div className="ml-3">
                  <label htmlFor="vat_enabled" className="text-sm font-medium text-gray-700">
                    MWST auf Rechnungen aktivieren
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Wenn aktiviert, werden auf Rechnungen MWST-Beträge ausgewiesen und berechnet.
                  </p>
                </div>
              </div>

              {/* Default VAT Rate Input (conditional) */}
              {companyFormData.vat_enabled && (
                <div>
                  <label htmlFor="default_vat_rate" className="block text-sm font-medium text-gray-700 mb-1">
                    Standard MWST-Satz (%)
                  </label>
                  <input
                    type="number"
                    id="default_vat_rate"
                    step="0.1"
                    min="0"
                    max="100"
                    value={companyFormData.default_vat_rate}
                    onChange={(e) => handleCompanyFieldChange('default_vat_rate', e.target.value)}
                    className="w-32 px-4 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
                    placeholder="8.1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Schweiz: 8.1% (Normal), 2.6% (Reduziert), 3.8% (Beherbergung)
                  </p>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={18} />
                {isSaving ? 'Speichert...' : 'Speichern'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab Content: User Profile */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Benutzerprofil</h2>
            <p className="text-sm text-gray-600">
              Diese Einstellungen gelten global für alle Firmen
            </p>
          </div>

          <form onSubmit={handleProfileSubmit} className="space-y-6">
            {/* Full Name */}
            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                id="full_name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
                placeholder="Ihr vollständiger Name"
              />
            </div>

            {/* Email (read-only) */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                E-Mail
              </label>
              <input
                type="email"
                id="email"
                value={user?.email || ''}
                disabled
                className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">
                E-Mail-Adresse kann nicht geändert werden
              </p>
            </div>

            {/* Password Change */}
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Passwort ändern</h3>

              <div className="space-y-4">
                <div>
                  <label htmlFor="new_password" className="block text-sm font-medium text-gray-700 mb-1">
                    Neues Passwort
                  </label>
                  <input
                    type="password"
                    id="new_password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
                    placeholder="Mindestens 6 Zeichen"
                  />
                </div>

                <div>
                  <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700 mb-1">
                    Passwort wiederholen
                  </label>
                  <input
                    type="password"
                    id="confirm_password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
                    placeholder="Passwort bestätigen"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={18} />
                {isSaving ? 'Speichert...' : 'Speichern'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab Content: Text Templates */}
      {activeTab === 'templates' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Textvorlagen</h2>
            <p className="text-sm text-gray-600">
              Standard-Texte für Offerten und Rechnungen (Markdown wird unterstützt)
            </p>
          </div>

          <form onSubmit={handleTemplatesSubmit} className="space-y-6">
            {/* Invoice Templates */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-gray-900">Rechnungen</h3>

              <div>
                <label htmlFor="invoice_intro" className="block text-sm font-medium text-gray-700 mb-1">
                  Einleitungstext
                </label>
                <textarea
                  id="invoice_intro"
                  value={invoiceIntro}
                  onChange={(e) => setInvoiceIntro(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition font-mono text-sm"
                  placeholder="Besten Dank für Ihren Auftrag. **Fett**, *kursiv*, - Listen..."
                />
                <p className="text-xs text-gray-500 mt-1">Erscheint oberhalb der Rechnungspo sitionen</p>
              </div>

              <div>
                <label htmlFor="invoice_footer" className="block text-sm font-medium text-gray-700 mb-1">
                  Fusstext / Bemerkungen
                </label>
                <textarea
                  id="invoice_footer"
                  value={invoiceFooter}
                  onChange={(e) => setInvoiceFooter(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition font-mono text-sm"
                  placeholder="Zahlbar innert 30 Tagen..."
                />
                <p className="text-xs text-gray-500 mt-1">Erscheint unterhalb der Rechnungspositionen</p>
              </div>
            </div>

            {/* Quote Templates */}
            <div className="space-y-4 border-t border-gray-200 pt-6">
              <h3 className="text-base font-semibold text-gray-900">Offerten</h3>

              <div>
                <label htmlFor="quote_intro" className="block text-sm font-medium text-gray-700 mb-1">
                  Einleitungstext
                </label>
                <textarea
                  id="quote_intro"
                  value={quoteIntro}
                  onChange={(e) => setQuoteIntro(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition font-mono text-sm"
                  placeholder="Vielen Dank für Ihre Anfrage..."
                />
                <p className="text-xs text-gray-500 mt-1">Erscheint oberhalb der Offertenpositionen</p>
              </div>

              <div>
                <label htmlFor="quote_footer" className="block text-sm font-medium text-gray-700 mb-1">
                  Fusstext / Bemerkungen
                </label>
                <textarea
                  id="quote_footer"
                  value={quoteFooter}
                  onChange={(e) => setQuoteFooter(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition font-mono text-sm"
                  placeholder="Wir freuen uns auf Ihre Antwort..."
                />
                <p className="text-xs text-gray-500 mt-1">Erscheint unterhalb der Offertenpositionen</p>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={18} />
                {isSaving ? 'Speichert...' : 'Alle speichern'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab Content: Product Categories (Phase 3.2) */}
      {activeTab === 'product_categories' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Produktkategorien verwalten</h2>
            <p className="text-sm text-gray-600">
              Definieren Sie Kategorien für Produkte und Dienstleistungen. Diese erscheinen als Dropdown bei der Produkterfassung.
            </p>
          </div>

          {/* Add New Product Category */}
          <div className="flex gap-2 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <input
              type="text"
              value={newProductCategory}
              onChange={(e) => setNewProductCategory(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddProductCategory();
                }
              }}
              placeholder="Neue Produktkategorie..."
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition bg-white"
            />
            <button
              onClick={handleAddProductCategory}
              disabled={!newProductCategory.trim()}
              className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Plus size={18} />
              Hinzufügen
            </button>
          </div>

          {/* Product Categories List */}
          {productCategories.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package size={48} className="mx-auto mb-4 opacity-50" />
              <p>Keine Produktkategorien vorhanden.</p>
              <p className="text-sm">Fügen Sie oben Ihre erste Kategorie hinzu.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {productCategories.map((category, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  {editingProductCategoryIndex === index ? (
                    <>
                      <input
                        type="text"
                        value={editProductCategoryValue}
                        onChange={(e) => setEditProductCategoryValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleUpdateProductCategory(index);
                          } else if (e.key === 'Escape') {
                            cancelEditProductCategory();
                          }
                        }}
                        className="flex-1 px-3 py-1 border border-gray-300 rounded focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none"
                        autoFocus
                      />
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={() => handleUpdateProductCategory(index)}
                          className="p-2 hover:bg-green-100 rounded transition"
                          title="Speichern"
                        >
                          <Check size={18} className="text-green-600" />
                        </button>
                        <button
                          onClick={cancelEditProductCategory}
                          className="p-2 hover:bg-red-100 rounded transition"
                          title="Abbrechen"
                        >
                          <X size={18} className="text-red-600" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="font-medium text-gray-900">{category}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEditProductCategory(index)}
                          className="p-2 hover:bg-gray-200 rounded transition"
                          title="Bearbeiten"
                        >
                          <Edit2 size={18} className="text-gray-600" />
                        </button>
                        <button
                          onClick={() => handleDeleteProductCategory(index)}
                          className="p-2 hover:bg-red-100 rounded transition"
                          title="Löschen"
                        >
                          <Trash2 size={18} className="text-red-600" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-gray-500 mt-4">
            Hinweis: Produktkategorien dienen zur Gruppierung im Produktkatalog und erscheinen als Dropdown bei der Produkterfassung.
          </p>
        </div>
      )}

      {/* Tab Content: Pipeline Settings */}
      {activeTab === 'pipeline' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Pipeline-Phasen verwalten</h2>
            <p className="text-sm text-gray-600">
              Definieren Sie die Phasen Ihrer Sales Pipeline. Diese werden im Kanban-Board angezeigt.
            </p>
          </div>

          {isLoadingStages ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-gray-500">Lädt...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stages.map((stage, index) => (
                <div
                  key={stage.id}
                  className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition"
                >
                  {/* Position */}
                  <div className="w-8 text-center text-sm font-medium text-gray-500">
                    {index + 1}
                  </div>

                  {/* Color */}
                  {editingStageId === stage.id ? (
                    <select
                      value={editStageColor}
                      onChange={(e) => setEditStageColor(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:border-brand focus:ring-1 focus:ring-brand outline-none"
                    >
                      {colorOptions.map((color) => (
                        <option key={color.value} value={color.value}>
                          {color.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div
                      className="w-6 h-6 rounded-full border-2 border-gray-200 flex-shrink-0"
                      style={{ backgroundColor: stage.color }}
                      title={stage.color}
                    />
                  )}

                  {/* Name */}
                  {editingStageId === stage.id ? (
                    <input
                      type="text"
                      value={editStageName}
                      onChange={(e) => setEditStageName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveStage(stage.id);
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:border-brand focus:ring-1 focus:ring-brand outline-none"
                      autoFocus
                    />
                  ) : (
                    <div className="flex-1 font-medium text-gray-900">{stage.name}</div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    {editingStageId === stage.id ? (
                      <>
                        <button
                          onClick={() => handleSaveStage(stage.id)}
                          className="p-2 hover:bg-green-100 rounded transition"
                          title="Speichern"
                        >
                          <Check size={18} className="text-green-600" />
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="p-2 hover:bg-red-100 rounded transition"
                          title="Abbrechen"
                        >
                          <X size={18} className="text-red-600" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleEditStage(stage)}
                          className="p-2 hover:bg-gray-100 rounded transition"
                          title="Bearbeiten"
                        >
                          <Edit2 size={18} className="text-gray-600" />
                        </button>
                        <button
                          onClick={() => handleDeleteStage(stage)}
                          className="p-2 hover:bg-red-100 rounded transition"
                          title="Löschen"
                        >
                          <Trash2 size={18} className="text-red-600" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}

              {/* Add New Stage Button */}
              <button
                onClick={handleAddStage}
                className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition flex items-center justify-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <Plus size={20} />
                <span className="font-medium">Neue Phase hinzufügen</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Buchungskategorien */}
      {activeTab === 'categories' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Buchungskategorien verwalten</h2>
            <p className="text-sm text-gray-600">
              Definieren Sie Kategorien für Einnahmen und Ausgaben. Diese erscheinen als Dropdown bei der Buchungserfassung.
            </p>
          </div>

          {/* Type Filter */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setCategoryTypeFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                categoryTypeFilter === 'all'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Alle
            </button>
            <button
              onClick={() => setCategoryTypeFilter('income')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                categoryTypeFilter === 'income'
                  ? 'bg-green-600 text-white'
                  : 'bg-green-50 text-green-700 hover:bg-green-100'
              }`}
            >
              <ArrowDownCircle size={16} />
              Einnahmen
            </button>
            <button
              onClick={() => setCategoryTypeFilter('expense')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                categoryTypeFilter === 'expense'
                  ? 'bg-red-600 text-white'
                  : 'bg-red-50 text-red-700 hover:bg-red-100'
              }`}
            >
              <ArrowUpCircle size={16} />
              Ausgaben
            </button>
          </div>

          {/* Add New Category */}
          <div className="flex flex-wrap gap-2 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCategory();
                }
              }}
              placeholder="Neue Kategorie..."
              className="flex-1 min-w-[200px] px-4 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition bg-white"
            />
            <select
              value={newCategoryType}
              onChange={(e) => setNewCategoryType(e.target.value as CategoryType)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition bg-white"
            >
              <option value="expense">Ausgabe</option>
              <option value="income">Einnahme</option>
            </select>
            <input
              type="color"
              value={newCategoryColor}
              onChange={(e) => setNewCategoryColor(e.target.value)}
              className="w-12 h-10 rounded-lg border border-gray-200 cursor-pointer"
              title="Farbe wählen"
            />
            <label className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={newCategoryTaxRelevant}
                onChange={(e) => setNewCategoryTaxRelevant(e.target.checked)}
                className="w-4 h-4 text-brand border-gray-300 rounded focus:ring-brand"
              />
              <span className="text-sm text-gray-700">Steuerrelevant</span>
            </label>
            <button
              onClick={handleAddCategory}
              disabled={!newCategoryName.trim() || isLoadingCategories}
              className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Plus size={18} />
              Hinzufügen
            </button>
          </div>

          {isLoadingCategories ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-gray-500">Lädt...</p>
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Tags size={48} className="mx-auto mb-4 opacity-50" />
              <p>Keine Kategorien gefunden.</p>
              <p className="text-sm">Fügen Sie oben Ihre erste Kategorie hinzu.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCategories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  {editingCategoryId === category.id ? (
                    <>
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="color"
                          value={editCategoryColor}
                          onChange={(e) => setEditCategoryColor(e.target.value)}
                          className="w-8 h-8 rounded border border-gray-200 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={editCategoryName}
                          onChange={(e) => setEditCategoryName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleUpdateCategory(category.id);
                            } else if (e.key === 'Escape') {
                              cancelEditCategory();
                            }
                          }}
                          className="flex-1 px-3 py-1 border border-gray-300 rounded focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none"
                          autoFocus
                        />
                        <label className="flex items-center gap-2 px-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editCategoryTaxRelevant}
                            onChange={(e) => setEditCategoryTaxRelevant(e.target.checked)}
                            className="w-4 h-4 text-brand border-gray-300 rounded focus:ring-brand"
                          />
                          <span className="text-xs text-gray-600">Steuer</span>
                        </label>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={() => handleUpdateCategory(category.id)}
                          className="p-2 hover:bg-green-100 rounded transition"
                          title="Speichern"
                        >
                          <Check size={18} className="text-green-600" />
                        </button>
                        <button
                          onClick={cancelEditCategory}
                          className="p-2 hover:bg-red-100 rounded transition"
                          title="Abbrechen"
                        >
                          <X size={18} className="text-red-600" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: category.color }}
                        />
                        <span className="font-medium text-gray-900">{category.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          category.type === 'income'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {category.type === 'income' ? 'Einnahme' : 'Ausgabe'}
                        </span>
                        {category.is_tax_relevant && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                            Steuerrelevant
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEditCategory(category)}
                          className="p-2 hover:bg-gray-200 rounded transition"
                          title="Bearbeiten"
                        >
                          <Edit2 size={18} className="text-gray-600" />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(category.id)}
                          className="p-2 hover:bg-red-100 rounded transition"
                          title="Deaktivieren"
                        >
                          <Trash2 size={18} className="text-red-600" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-gray-500 mt-4">
            Hinweis: Deaktivierte Kategorien werden aus dem Dropdown entfernt, bestehende Buchungen bleiben erhalten.
          </p>
        </div>
      )}
    </div>
  );
}
