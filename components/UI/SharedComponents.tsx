
import React, { useEffect, useState, useRef } from 'react';
import { ChevronDown, Check, Calendar as CalendarIcon } from 'lucide-react';

// --- Card ---
export const Card: React.FC<{ children: React.ReactNode; className?: string; title?: string }> = ({ children, className = '', title }) => (
  <div className={`bg-slate-900/40 backdrop-blur-md border border-slate-700/50 rounded-xl p-6 shadow-xl ${className}`}>
    {title && <h3 className="text-lg font-semibold text-slate-100 mb-4 border-b border-slate-700 pb-2">{title}</h3>}
    {children}
  </div>
);

// --- Button ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: React.ReactNode;
}
export const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', className = '', icon, ...props }) => {
  const baseStyle = "flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20",
    secondary: "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700",
    danger: "bg-rose-600 hover:bg-rose-500 text-white",
    ghost: "bg-transparent hover:bg-slate-800/50 text-slate-400 hover:text-white"
  };

  return (
    <button className={`${baseStyle} ${variants[variant]} ${className}`} {...props}>
      {icon && <span className="w-4 h-4">{icon}</span>}
      {children}
    </button>
  );
};

// --- Input ---
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}
/**
 * Enhanced Input component.
 * For type="date", it ensures the native picker (scroller on mobile) is triggered easily.
 */
export const Input: React.FC<InputProps> = ({ label, className = '', ...props }) => {
  const isDate = props.type === 'date';
  
  return (
    <div className="flex flex-col gap-1 w-full text-right">
      {label && <label className="text-xs text-slate-400 font-medium mb-1">{label}</label>}
      <div className="relative">
        <input 
          className={`bg-slate-950/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-600 w-full ${isDate ? 'cursor-pointer' : ''} ${className}`}
          {...props} 
        />
        {isDate && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
            <CalendarIcon size={16} />
          </div>
        )}
      </div>
    </div>
  );
};

// --- Select ---
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}
export const Select: React.FC<SelectProps> = ({ label, options, className = '', ...props }) => (
  <div className="flex flex-col gap-1 w-full text-right">
    {label && <label className="text-xs text-slate-400 font-medium mb-1">{label}</label>}
    <div className="relative">
        <select 
          className={`w-full bg-slate-950/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-all appearance-none text-right pr-3 pl-10 ${className}`}
          {...props} 
        >
            {options.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
        </select>
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
            <ChevronDown size={16} />
        </div>
    </div>
  </div>
);

// --- MultiSelect ---
interface MultiSelectProps {
    label?: string;
    options: { value: string; label: string }[];
    selectedValues: string[];
    onChange: (values: string[]) => void;
    placeholder?: string;
    className?: string;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({ label, options, selectedValues, onChange, placeholder = "בחר...", className = "" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (val: string) => {
        if (val === 'all') {
            onChange(['all']);
            setIsOpen(false);
            return;
        }

        let newValues = selectedValues.filter(v => v !== 'all');
        if (newValues.includes(val)) {
            newValues = newValues.filter(v => v !== val);
        } else {
            newValues.push(val);
        }

        if (newValues.length === 0) {
            onChange(['all']);
        } else {
            onChange(newValues);
        }
    };

    const getDisplayText = () => {
        if (selectedValues.includes('all')) return 'כל הישויות (מאוחד)';
        if (selectedValues.length === 1) return options.find(o => o.value === selectedValues[0])?.label || placeholder;
        return `${selectedValues.length} ישויות נבחרו`;
    };

    return (
        <div className={`flex flex-col gap-1 w-full text-right relative ${className}`} ref={containerRef}>
            {label && <label className="text-xs text-slate-400 font-medium mb-1">{label}</label>}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 flex items-center justify-between hover:border-indigo-500 transition-all text-right"
            >
                <ChevronDown size={16} className={`text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                <span className="truncate">{getDisplayText()}</span>
            </button>

            {isOpen && (
                <div 
                  className="absolute top-full mt-2 right-0 min-w-full w-max max-w-[450px] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-[100] py-2 max-h-80 overflow-y-auto overflow-x-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                  style={{ direction: 'ltr' }} 
                >
                    <div style={{ direction: 'rtl' }}> 
                        {options.map(option => {
                            const isSelected = selectedValues.includes(option.value);
                            return (
                                <button
                                    key={option.value}
                                    onClick={() => toggleOption(option.value)}
                                    className={`w-full text-right px-4 py-2.5 text-sm flex items-center gap-3 transition-colors ${isSelected ? 'bg-indigo-600/20 text-indigo-300' : 'text-slate-300 hover:bg-slate-800'}`}
                                >
                                    <div className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-600 bg-slate-950'}`}>
                                        {isSelected && <Check size={12} className="text-white" />}
                                    </div>
                                    <span className="whitespace-nowrap font-medium flex-1">{option.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Modal ---
export const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ isOpen, onClose, title, children }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">&times;</button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

// --- KPI Card ---
export const KPICard: React.FC<{ title: string; value: React.ReactNode; trend?: string; trendUp?: boolean; icon?: React.ReactNode }> = ({ title, value, trend, trendUp, icon }) => (
  <Card className="flex flex-col justify-between h-32 relative overflow-hidden group hover:border-indigo-500/50 transition-colors">
    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-white">
      {icon}
    </div>
    <div className="text-slate-400 text-sm font-medium z-10">{title}</div>
    <div className="flex items-end justify-between z-10 w-full">
      <div className="text-2xl font-bold text-white w-full">{value}</div>
      {trend && (
        <div className={`text-xs px-2 py-1 rounded-full shrink-0 ${trendUp ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
          {trend}
        </div>
      )}
    </div>
  </Card>
);
