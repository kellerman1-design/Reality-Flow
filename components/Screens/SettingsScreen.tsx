
import React, { useRef } from 'react';
import { Card, Input, Button } from '../UI/SharedComponents';
import { GlobalSettings, AppState } from '../../types';
import { Save, Upload, FileSpreadsheet, RefreshCw, TrendingUp, Calendar } from 'lucide-react';
import { exportFullStateToExcel, importFullStateFromExcel } from '../../utils';

interface SettingsScreenProps {
  settings: GlobalSettings;
  setSettings: React.Dispatch<React.SetStateAction<GlobalSettings>>;
  fullState: AppState;
  onRestore: (newState: AppState) => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ settings, setSettings, fullState, onRestore }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        try {
            const newState = await importFullStateFromExcel(file);
            onRestore(newState);
            alert('הדוח נטען בהצלחה! כל הנתונים שוחזרו.');
        } catch (error) {
            console.error(error);
            alert('שגיאה בטעינת הקובץ. וודא שהפורמט תקין.');
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExport = () => {
    try {
        exportFullStateToExcel(fullState);
    } catch (error) {
        console.error(error);
        alert('שגיאה בייצוא הדוח.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 text-right">
      
      <Card className="bg-slate-900 border border-slate-800 p-8 shadow-2xl">
          <div className="mb-8 border-b border-slate-800 pb-4">
              <h3 className="text-xl font-bold text-slate-100">הגדרות מערכת</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <Input 
                 label='שיעור מע"מ (%)'
                 type="number"
                 className="text-right font-bold text-lg"
                 value={settings.vatRate}
                 onChange={e => setSettings({...settings, vatRate: Number(e.target.value)})}
              />
              <Input 
                 label='ריבית פריים נוכחית (%)'
                 type="number"
                 className="text-right font-bold text-lg border-indigo-500/50"
                 value={settings.primeRate}
                 onChange={e => setSettings({...settings, primeRate: Number(e.target.value)})}
              />
          </div>

          <div className="bg-slate-800/40 border border-slate-700 p-6 rounded-xl mb-12 space-y-6">
              <div className="flex items-center gap-2 mb-2 text-indigo-400">
                  <TrendingUp size={18} />
                  <h4 className="font-bold">תזמון שינוי ריבית</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input 
                      label='ריבית פריים קודמת (%)'
                      type="number"
                      className="text-right font-medium"
                      value={settings.prevPrimeRate || 0}
                      onChange={e => setSettings({...settings, prevPrimeRate: Number(e.target.value)})}
                  />
                  <Input 
                      label='מועד שינוי ריבית פריים'
                      type="date"
                      className="text-right font-medium"
                      value={settings.primeRateChangeDate || ''}
                      onChange={e => setSettings({...settings, primeRateChangeDate: e.target.value})}
                  />
              </div>
              <p className="text-xs text-slate-500">
                  * המערכת תשתמש בריבית הקודמת עבור כל התנועות שמועדן חל לפני התאריך הנבחר, ובריבית הנוכחית החל מתאריך זה.
              </p>
          </div>

          <div className="mb-12">
              <div className="flex items-center gap-2 mb-1">
                 <label className="text-xs text-slate-400 font-medium">מדד המחירים לצרכן (נקודות)</label>
                 <TrendingUp size={12} className="text-emerald-400" />
              </div>
              <input 
                 type="number"
                 className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-3 text-lg font-bold text-slate-100 focus:outline-none focus:border-indigo-500 transition-all text-right"
                 value={settings.cpi}
                 onChange={e => setSettings({...settings, cpi: Number(e.target.value)})}
              />
              <p className="text-xs text-slate-500 mt-2">
                  * נתון זה משמש לחישוב סכומים צמודים (כגון שכירויות). השינוי יחול על כל התקופות בסימולציה.
              </p>
          </div>

          <div className="border-t border-slate-800 pt-8">
              <div className="flex items-center gap-2 mb-6">
                  <FileSpreadsheet className="text-emerald-500" size={20} />
                  <h4 className="text-lg font-bold text-slate-200">ייצוא וניהול דוח מלא</h4>
              </div>

              <div className="flex flex-col md:flex-row gap-4">
                  
                  <div className="flex-1">
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept=".xlsx, .xls"
                        onChange={handleImport} 
                      />
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex items-center justify-center gap-3 bg-orange-600 hover:bg-orange-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-orange-600/20 active:scale-95"
                      >
                          <RefreshCw size={20} />
                          טעינת דוח מלא (שחזור)
                      </button>
                  </div>

                  <div className="flex-1">
                      <button 
                        onClick={handleExport}
                        className="w-full flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
                      >
                          <FileSpreadsheet size={20} />
                          ייצוא דוח מלא (גיבוי)
                      </button>
                  </div>

              </div>
          </div>
      </Card>
    </div>
  );
};
