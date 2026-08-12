import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useYearEnd } from '../hooks/useYearEnd';
import type { Asset, PrivateShare, YearEndClosingData } from '../lib/supabase';

export default function Jahresabschluss() {
  // Year selection (default to current year)
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // Fetch year-end data
  const { loading, error, closing, calculation, saveClosing, lockClosing, unlockClosing } =
    useYearEnd(selectedYear);

  // Local form state (synced with closing data)
  const [formData, setFormData] = useState<YearEndClosingData>({
    assets: [],
    private_shares: [],
    social_security_provision: 0,
  });

  // Sync form data when closing data is loaded
  useEffect(() => {
    if (closing?.data) {
      setFormData(closing.data);
    } else {
      setFormData({
        assets: [],
        private_shares: [],
        social_security_provision: 0,
      });
    }
  }, [closing]);

  // Generate year options (last 5 years)
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const isLocked = closing?.status === 'locked';
  const isDraft = closing?.status === 'draft' || !closing;

  // ============================================
  // HANDLERS: Assets (Depreciations)
  // ============================================

  const addAsset = () => {
    const newAsset: Asset = {
      name: '',
      value: 0,
      depreciation_rate: 40, // Default 40% for IT equipment
      amount: 0,
    };
    setFormData({
      ...formData,
      assets: [...formData.assets, newAsset],
    });
  };

  const updateAsset = (index: number, field: keyof Asset, value: string | number) => {
    const updatedAssets = [...formData.assets];
    updatedAssets[index] = {
      ...updatedAssets[index],
      [field]: value,
    };

    // Auto-calculate depreciation amount
    if (field === 'value' || field === 'depreciation_rate') {
      const assetValue = field === 'value' ? Number(value) : updatedAssets[index].value;
      const rate = field === 'depreciation_rate' ? Number(value) : updatedAssets[index].depreciation_rate;
      updatedAssets[index].amount = (assetValue * rate) / 100;
    }

    setFormData({ ...formData, assets: updatedAssets });
  };

  const removeAsset = (index: number) => {
    const updatedAssets = formData.assets.filter((_, i) => i !== index);
    setFormData({ ...formData, assets: updatedAssets });
  };

  // ============================================
  // HANDLERS: Private Shares
  // ============================================

  const addPrivateShare = () => {
    const newShare: PrivateShare = {
      category: '',
      percentage: 0,
      amount: 0,
    };
    setFormData({
      ...formData,
      private_shares: [...formData.private_shares, newShare],
    });
  };

  const updatePrivateShare = (index: number, field: keyof PrivateShare, value: string | number) => {
    const updatedShares = [...formData.private_shares];
    updatedShares[index] = {
      ...updatedShares[index],
      [field]: value,
    };
    setFormData({ ...formData, private_shares: updatedShares });
  };

  const removePrivateShare = (index: number) => {
    const updatedShares = formData.private_shares.filter((_, i) => i !== index);
    setFormData({ ...formData, private_shares: updatedShares });
  };

  // ============================================
  // HANDLERS: Save & Lock
  // ============================================

  const handleSave = async () => {
    try {
      await saveClosing(formData);
      toast.error('Jahresabschluss erfolgreich gespeichert!');
    } catch (err) {
      toast.error('Fehler beim Speichern');
    }
  };

  const handleLock = async () => {
    if (confirm('Möchten Sie diesen Jahresabschluss wirklich abschliessen? Er kann danach nicht mehr bearbeitet werden.')) {
      try {
        await lockClosing();
        toast.error('Jahresabschluss abgeschlossen!');
      } catch (err) {
        toast.error('Fehler beim Abschliessen');
      }
    }
  };

  const handleUnlock = async () => {
    if (confirm('Möchten Sie diesen Jahresabschluss wieder öffnen?')) {
      try {
        await unlockClosing();
        toast.error('Jahresabschluss wieder geöffnet!');
      } catch (err) {
        toast.error('Fehler beim Öffnen');
      }
    }
  };

  const handleExportPDF = () => {
    toast.error('PDF-Export kommt in Phase 3!');
  };

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center">Lade Jahresabschluss...</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* ============================================ */}
      {/* HEADER */}
      {/* ============================================ */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Jahresabschluss</h1>
          <p className="text-gray-600">
            Einnahmen-Überschuss-Rechnung mit steuerlichen Korrekturen
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Year Selector */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>

          {/* Status Badge */}
          {closing && (
            <span
              className={`px-4 py-2 rounded-full text-sm font-semibold ${
                isLocked
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              {isLocked ? 'Abgeschlossen' : 'Entwurf'}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
        </div>
      )}

      {/* ============================================ */}
      {/* SECTION A: BASIS-DATEN (Read Only) */}
      {/* ============================================ */}
      <section className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          A. Basis-Daten (aus Buchhaltung)
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Diese Zahlen werden automatisch aus Ihren bezahlten Rechnungen und Ausgaben berechnet.
        </p>

        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Einnahmen</div>
            <div className="text-2xl font-bold text-green-700">
              CHF {calculation.rawIncome.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="p-4 bg-red-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Ausgaben</div>
            <div className="text-2xl font-bold text-red-700">
              CHF {calculation.rawExpense.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Vorläufiger Gewinn</div>
            <div className="text-2xl font-bold text-blue-700">
              CHF {calculation.rawProfit.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* SECTION B: ABSCHREIBUNGEN */}
      {/* ============================================ */}
      <section className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              B. Abschreibungen
            </h2>
            <p className="text-sm text-gray-600">
              Haben Sie Investitionen über 1'000 CHF getätigt? (z.B. Computer, Maschinen, Mobiliar)
            </p>
            <p className="text-xs text-gray-500 mt-1">
              💡 Tipp: IT-Geräte werden mit 40% pro Jahr abgeschrieben, Mobiliar mit 20%.
            </p>
          </div>
        </div>

        {formData.assets.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Keine Abschreibungen erfasst
          </div>
        ) : (
          <div className="space-y-3 mb-4">
            {formData.assets.map((asset, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="grid grid-cols-4 gap-3">
                  <input
                    type="text"
                    placeholder="Name (z.B. Laptop)"
                    value={asset.name}
                    onChange={(e) => updateAsset(index, 'name', e.target.value)}
                    disabled={isLocked}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                  <input
                    type="number"
                    placeholder="Kaufpreis (CHF)"
                    value={asset.value || ''}
                    onChange={(e) => updateAsset(index, 'value', Number(e.target.value))}
                    disabled={isLocked}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                  <input
                    type="number"
                    placeholder="Satz (%)"
                    value={asset.depreciation_rate || ''}
                    onChange={(e) => updateAsset(index, 'depreciation_rate', Number(e.target.value))}
                    disabled={isLocked}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-gray-700">
                      CHF {asset.amount.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                    </div>
                    {!isLocked && (
                      <button
                        onClick={() => removeAsset(index)}
                        className="ml-auto px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLocked && (
          <button
            onClick={addAsset}
            className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition"
          >
            + Anlage hinzufügen
          </button>
        )}

        <div className="mt-4 p-3 bg-orange-50 rounded-lg">
          <div className="text-sm text-gray-700">
            <strong>Total Abschreibungen:</strong> CHF {calculation.totalDepreciations.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* SECTION C: PRIVATANTEILE */}
      {/* ============================================ */}
      <section className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              C. Privatanteile
            </h2>
            <p className="text-sm text-gray-600">
              Haben Sie Ausgaben, die teilweise privat genutzt werden? (z.B. Handy, Auto, Home-Office)
            </p>
            <p className="text-xs text-gray-500 mt-1">
              💡 Tipp: Privatanteile ERHÖHEN den steuerbaren Gewinn, da sie keine geschäftlichen Ausgaben sind.
            </p>
          </div>
        </div>

        {formData.private_shares.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Keine Privatanteile erfasst
          </div>
        ) : (
          <div className="space-y-3 mb-4">
            {formData.private_shares.map((share, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="grid grid-cols-4 gap-3">
                  <input
                    type="text"
                    placeholder="Kategorie (z.B. Handy)"
                    value={share.category}
                    onChange={(e) => updatePrivateShare(index, 'category', e.target.value)}
                    disabled={isLocked}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                  <input
                    type="number"
                    placeholder="Privat-% (z.B. 20)"
                    value={share.percentage || ''}
                    onChange={(e) => updatePrivateShare(index, 'percentage', Number(e.target.value))}
                    disabled={isLocked}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                  <input
                    type="number"
                    placeholder="Betrag (CHF)"
                    value={share.amount || ''}
                    onChange={(e) => updatePrivateShare(index, 'amount', Number(e.target.value))}
                    disabled={isLocked}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                  <div className="flex items-center">
                    {!isLocked && (
                      <button
                        onClick={() => removePrivateShare(index)}
                        className="ml-auto px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLocked && (
          <button
            onClick={addPrivateShare}
            className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition"
          >
            + Privatanteil hinzufügen
          </button>
        )}

        <div className="mt-4 p-3 bg-green-50 rounded-lg">
          <div className="text-sm text-gray-700">
            <strong>Total Privatanteile:</strong> CHF {calculation.totalPrivateShares.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* SECTION D: RÜCKSTELLUNGEN */}
      {/* ============================================ */}
      <section className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            D. Rückstellungen (AHV/IV/EO)
          </h2>
          <p className="text-sm text-gray-600">
            Geschätzte Sozialversicherungsbeiträge für das Jahr
          </p>
          <p className="text-xs text-gray-500 mt-1">
            💡 Tipp: Ca. 10% des Gewinns für AHV/IV/EO-Beiträge einplanen.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">
            Geschuldete Beiträge (CHF):
          </label>
          <input
            type="number"
            value={formData.social_security_provision || ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                social_security_provision: Number(e.target.value),
              })
            }
            disabled={isLocked}
            placeholder="0.00"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
        </div>

        <div className="mt-4 p-3 bg-orange-50 rounded-lg">
          <div className="text-sm text-gray-700">
            <strong>Total Rückstellungen:</strong> CHF {calculation.socialSecurityProvision.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* SUMMARY: STEUERBARER GEWINN */}
      {/* ============================================ */}
      <section className="mb-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-8 text-white">
        <h2 className="text-2xl font-bold mb-6">Steuerbarer Gewinn {selectedYear}</h2>

        <div className="space-y-2 mb-6 text-blue-50">
          <div className="flex justify-between">
            <span>Vorläufiger Gewinn:</span>
            <span className="font-semibold">
              CHF {calculation.rawProfit.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between">
            <span>- Abschreibungen:</span>
            <span className="font-semibold">
              CHF {calculation.totalDepreciations.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between">
            <span>+ Privatanteile:</span>
            <span className="font-semibold">
              CHF {calculation.totalPrivateShares.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between">
            <span>- Rückstellungen (AHV):</span>
            <span className="font-semibold">
              CHF {calculation.socialSecurityProvision.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="pt-4 border-t border-blue-400 flex justify-between items-center">
          <span className="text-2xl font-bold">Steuerbarer Gewinn:</span>
          <span className="text-4xl font-bold">
            CHF {calculation.taxableProfit.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </section>

      {/* ============================================ */}
      {/* ACTION BUTTONS */}
      {/* ============================================ */}
      <div className="flex gap-4">
        {isDraft && (
          <>
            <button
              onClick={handleSave}
              className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition"
            >
              Entwurf speichern
            </button>
            <button
              onClick={handleLock}
              className="flex-1 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition"
            >
              Abschluss finalisieren
            </button>
          </>
        )}

        {isLocked && (
          <>
            <button
              onClick={handleUnlock}
              className="flex-1 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-semibold transition"
            >
              Abschluss wieder öffnen
            </button>
            <button
              onClick={handleExportPDF}
              className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition"
            >
              PDF-Bericht exportieren
            </button>
          </>
        )}
      </div>
    </div>
  );
}
