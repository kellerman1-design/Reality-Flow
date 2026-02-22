import React, { useState } from 'react';
import { Card, Button, Input, Modal, Select } from '../UI/SharedComponents';
import { Entity } from '../../types';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { generateId } from '../../utils';

interface EntitiesScreenProps {
  entities: Entity[];
  setEntities: React.Dispatch<React.SetStateAction<Entity[]>>;
}

export const EntitiesScreen: React.FC<EntitiesScreenProps> = ({ entities, setEntities }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null);

  const initialFormState: Entity = {
    id: '',
    name: '',
    parentId: '',
    ownershipPercentage: 100,
    uncalledCapital: 0,
    targetBalance: 0,
    hasTaxAdvances: false,
    taxAdvanceRate: 0
  };

  const [formData, setFormData] = useState<Entity>(initialFormState);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleOpenModal = (entity?: Entity) => {
    if (entity) {
      setEditingEntity(entity);
      setFormData(entity);
    } else {
      setEditingEntity(null);
      setFormData({ ...initialFormState, id: generateId() });
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (editingEntity) {
      setEntities(prev => prev.map(e => e.id === editingEntity.id ? formData : e));
    } else {
      setEntities(prev => [...prev, formData]);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    setEntities(prev => prev.filter(e => e.id !== id));
    setDeleteConfirmId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">ניהול ישויות</h2>
        <Button onClick={() => handleOpenModal()} icon={<Plus size={18} />}>הוסף ישות</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {entities.map(entity => (
          <Card key={entity.id} className="relative group">
            <div className="absolute top-4 left-4 flex gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
               <button 
                 type="button"
                 onClick={(e) => { e.stopPropagation(); handleOpenModal(entity); }} 
                 className="p-2 bg-slate-800 rounded-full hover:bg-indigo-600 transition-colors"
               >
                 <Edit2 size={14}/>
               </button>
               <button 
                 type="button"
                 onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(entity.id); }} 
                 className="p-2 bg-slate-800 rounded-full hover:bg-rose-600 transition-colors"
               >
                 <Trash2 size={14}/>
               </button>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{entity.name}</h3>
            <div className="space-y-2 text-sm text-slate-400">
              <div className="flex justify-between">
                 <span>ישות אם:</span>
                 <span className="text-slate-200">
                    {entity.parentId ? entities.find(e => e.id === entity.parentId)?.name || 'לא נמצא' : '-'}
                 </span>
              </div>
              <div className="flex justify-between">
                <span>אחזקה:</span>
                <span className="text-slate-200">{entity.ownershipPercentage}%</span>
              </div>
              <div className="flex justify-between">
                <span>הון לא קרוא:</span>
                <span className="text-slate-200">{entity.uncalledCapital.toLocaleString()} ₪</span>
              </div>
              <div className="flex justify-between">
                <span>יתרת מטרה:</span>
                <span className="text-slate-200">{entity.targetBalance.toLocaleString()} ₪</span>
              </div>
              {entity.hasTaxAdvances && (
                 <div className="flex justify-between text-amber-500">
                    <span>מקדמות מס:</span>
                    <span>{entity.taxAdvanceRate}%</span>
                 </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Modal isOpen={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)} title="אישור מחיקה">
        <div className="p-4 text-center">
            <p className="text-slate-300 mb-6">האם אתה בטוח שברצונך למחוק ישות זו? פעולה זו תמחק גם את כל הנתונים הקשורים אליה.</p>
            <div className="flex justify-center gap-4">
                <Button variant="secondary" onClick={() => setDeleteConfirmId(null)}>ביטול</Button>
                <Button onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)} className="bg-rose-600 hover:bg-rose-700">מחק ישות</Button>
            </div>
        </div>
      </Modal>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingEntity ? 'ערוך ישות' : 'ישות חדשה'}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input 
                label="שם הישות" 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
            />
            
            <Select 
                label="ישות אם"
                options={[
                    { value: '', label: 'ללא (חברת גג)' },
                    ...entities
                        .filter(e => e.id !== formData.id)
                        .map(e => ({ value: e.id, label: e.name }))
                ]}
                value={formData.parentId || ''}
                onChange={e => setFormData({...formData, parentId: e.target.value})}
            />

            <Input 
                label="אחוז אחזקה" 
                type="number" 
                value={formData.ownershipPercentage} 
                onChange={e => setFormData({...formData, ownershipPercentage: Number(e.target.value)})} 
            />
            <Input 
                label="הון לא קרוא" 
                type="number" 
                value={formData.uncalledCapital} 
                onChange={e => setFormData({...formData, uncalledCapital: Number(e.target.value)})} 
            />
            <Input 
                label="יתרת עו״ש רצויה (Target Balance)" 
                type="number" 
                value={formData.targetBalance} 
                onChange={e => setFormData({...formData, targetBalance: Number(e.target.value)})} 
            />
            <div className="md:col-span-2 flex items-center gap-4 border border-slate-700 p-3 rounded-lg">
                <input 
                    type="checkbox" 
                    checked={formData.hasTaxAdvances} 
                    onChange={e => setFormData({...formData, hasTaxAdvances: e.target.checked})} 
                    className="w-5 h-5 accent-indigo-500"
                />
                <span className="text-sm text-slate-300">משלם מקדמות מס?</span>
                {formData.hasTaxAdvances && (
                     <Input 
                        label="שיעור מקדמה (%)" 
                        type="number" 
                        className="w-32"
                        value={formData.taxAdvanceRate} 
                        onChange={e => setFormData({...formData, taxAdvanceRate: Number(e.target.value)})} 
                    />
                )}
            </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>ביטול</Button>
            <Button onClick={handleSave}>שמור</Button>
        </div>
      </Modal>
    </div>
  );
};