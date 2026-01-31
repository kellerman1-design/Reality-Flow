
import React, { useState, useMemo, useRef } from 'react';
import { Button, Input, Modal, Select } from '../UI/SharedComponents';
import { Task, Entity, Attachment, Frequency } from '../../types';
import { Plus, Search, AlertTriangle, Calendar, CheckCircle, Circle, Upload, FileText, User, Edit2, Trash2, X, Paperclip, Repeat } from 'lucide-react';
import { generateId, formatDate, processFile } from '../../utils';

interface TasksScreenProps {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  entities: Entity[];
}

export const TasksScreen: React.FC<TasksScreenProps> = ({ tasks, setTasks, entities }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEntity, setFilterEntity] = useState('all');
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // File Upload State
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [newAttachments, setNewAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const initialFormState: Task = {
    id: '',
    title: '',
    description: '',
    dueDate: new Date().toISOString().split('T')[0],
    priority: 'Medium',
    entityId: entities[0]?.id || '',
    assignee: '',
    isCompleted: false,
    isRecurring: false,
    frequency: 'Monthly',
    recurringDayMode: 'SameAsStart',
    dayInMonth: 1,
    attachments: []
  };

  const [formData, setFormData] = useState<Task>(initialFormState);

  // --- Logic ---
  const handleOpenModal = (task?: Task) => {
    if (task) {
        setEditingTask(task);
        setFormData({
            ...initialFormState,
            ...task
        });
        setNewAttachments([]);
    } else {
        setEditingTask(null);
        setFormData({...initialFormState, entityId: entities[0]?.id || ''});
        setNewAttachments([]);
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.title) return;
    
    const combinedAttachments = [...(formData.attachments || []), ...newAttachments];
    
    const taskToSave = {
        ...formData,
        attachments: combinedAttachments
    };

    if (editingTask) {
        setTasks(prev => prev.map(t => t.id === editingTask.id ? taskToSave : t));
    } else {
        setTasks(prev => [...prev, { ...taskToSave, id: generateId() }]);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('האם אתה בטוח שברצונך למחוק משימה זו?')) {
        setTasks(prev => prev.filter(t => t.id !== id));
    }
  };

  const toggleComplete = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, isCompleted: !t.isCompleted } : t));
  };

  // --- Attachment Handlers ---
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
        const files = Array.from(e.target.files);
        const processed = await Promise.all(files.map(processFile));
        setNewAttachments(prev => [...prev, ...processed]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => { 
      e.preventDefault(); 
      setIsDragging(true); 
  };
  
  const handleDrop = async (e: React.DragEvent) => {
      e.preventDefault(); 
      setIsDragging(false);
      if (e.dataTransfer.files) {
          const files = Array.from(e.dataTransfer.files);
          const processed = await Promise.all(files.map(processFile));
          setNewAttachments(prev => [...prev, ...processed]);
      }
  };

  const removeNewAttachment = (index: number) => {
    setNewAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingAttachment = (attId: string) => {
    setFormData(prev => ({
        ...prev,
        attachments: prev.attachments?.filter(a => a.id !== attId)
    }));
  };

  const upcomingTasks = useMemo(() => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const today = new Date();
    today.setHours(0,0,0,0);

    return tasks.filter(t => {
      const d = new Date(t.dueDate);
      return !t.isCompleted && d >= today && d <= nextWeek;
    });
  }, [tasks]);

  const filteredTasks = tasks.filter(t => {
    const matchesSearch = t.assignee.includes(searchQuery) || t.title.includes(searchQuery);
    const matchesEntity = filterEntity === 'all' || t.entityId === filterEntity;
    return matchesSearch && matchesEntity;
  }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()); // Sort by date asc

  // --- Render Helpers ---
  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'High': return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      case 'Medium': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'Low': return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
      default: return 'bg-slate-700 text-slate-300';
    }
  };

  const getPriorityLabel = (p: string) => {
    switch (p) {
        case 'High': return 'גבוהה';
        case 'Medium': return 'בינונית';
        case 'Low': return 'נמוכה';
        default: return p;
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header & Actions */}
      <div className="flex justify-end items-center">
        <Button onClick={() => handleOpenModal()} icon={<Plus size={18} />}>
            הוספת משימה
        </Button>
      </div>

      {/* Alert Banner */}
      {upcomingTasks.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/30 rounded-xl p-4 flex items-start gap-4 shadow-[0_0_30px_-10px_rgba(245,158,11,0.2)]">
            <div className="bg-amber-500/20 p-2 rounded-full text-amber-500 shrink-0 mt-1">
                <AlertTriangle size={24} />
            </div>
            <div className="flex-1">
                <h3 className="text-amber-500 font-bold text-lg mb-1">משימות לביצוע השבוע</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                    {upcomingTasks.map(task => (
                        <div key={task.id} className="flex justify-between items-center text-sm p-2 bg-amber-500/10 rounded border border-amber-500/20">
                            <span className="font-medium text-amber-100">{task.title}</span>
                            <span className="text-amber-400/80">{formatDate(task.dueDate)}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 items-center bg-slate-900/40 p-3 rounded-xl border border-slate-800">
         <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input 
                type="text" 
                placeholder="חפש לפי אחראי..." 
                className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 pr-10 pl-4 text-sm text-white focus:outline-none focus:border-indigo-500"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
            />
         </div>
         <div className="w-64">
            <Select 
                options={[{value: 'all', label: 'כל הישויות (מאוחד)'}, ...entities.map(e => ({value: e.id, label: e.name}))]} 
                value={filterEntity}
                onChange={e => setFilterEntity(e.target.value)}
                className="bg-slate-950"
            />
         </div>
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {filteredTasks.map(task => (
            <div 
                key={task.id} 
                className={`group flex items-center justify-between p-4 rounded-xl border transition-all duration-200 ${task.isCompleted ? 'bg-slate-900/20 border-slate-800 opacity-60' : 'bg-slate-900/60 border-slate-700 hover:border-indigo-500/50 hover:bg-slate-800/80'}`}
            >
                {/* Left Section (Details) */}
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                        <h4 className={`text-lg font-bold ${task.isCompleted ? 'text-slate-500 line-through' : 'text-white'}`}>{task.title}</h4>
                        {task.isRecurring && <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded border border-slate-600">מחזורי</span>}
                        {task.attachments && task.attachments.length > 0 && (
                            <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/20 flex items-center gap-1">
                                <Paperclip size={10} /> {task.attachments.length} קבצים
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-slate-400 mb-3 line-clamp-1">{task.description}</p>
                    
                    <div className="flex items-center gap-3 text-xs">
                        <span className={`px-2 py-1 rounded border font-medium flex items-center gap-1.5 ${getPriorityColor(task.priority)}`}>
                           {getPriorityLabel(task.priority)}
                        </span>
                        <span className="flex items-center gap-1.5 text-slate-300 bg-slate-800 px-2 py-1 rounded border border-slate-700">
                           <Calendar size={12} />
                           {formatDate(task.dueDate)}
                        </span>
                        <span className="flex items-center gap-1.5 text-slate-300 bg-slate-800 px-2 py-1 rounded border border-slate-700">
                           <User size={12} />
                           {task.assignee}
                        </span>
                         <span className="text-indigo-400/80">
                           {entities.find(e => e.id === task.entityId)?.name}
                        </span>
                    </div>
                </div>

                {/* Right Section (Action) */}
                <div className="mr-6 flex items-center gap-4">
                    {/* Action Buttons (Show on Hover) */}
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                         <button 
                            onClick={(e) => { e.stopPropagation(); handleOpenModal(task); }} 
                            className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-full transition-colors"
                            title="ערוך משימה"
                        >
                            <Edit2 size={18} />
                         </button>
                         <button 
                            onClick={(e) => handleDelete(task.id, e)} 
                            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-full transition-colors"
                            title="מחק משימה"
                         >
                            <Trash2 size={18} />
                         </button>
                    </div>

                    {/* Toggle Completion */}
                    <button 
                        onClick={() => toggleComplete(task.id)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${task.isCompleted ? 'text-emerald-500 bg-emerald-500/10' : 'text-slate-600 hover:text-slate-400'}`}
                        title={task.isCompleted ? 'סמן כלא הושלם' : 'סמן כהושלם'}
                    >
                        {task.isCompleted ? <CheckCircle size={32} /> : <Circle size={32} />}
                    </button>
                </div>
            </div>
        ))}
        {filteredTasks.length === 0 && (
            <div className="text-center py-20 text-slate-500 flex flex-col items-center">
                <FileText size={48} className="mb-4 opacity-20" />
                <p>לא נמצאו משימות לתצוגה</p>
            </div>
        )}
      </div>

      {/* Add/Edit Task Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingTask ? 'עריכת משימה' : 'הוספת משימה'}>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="md:col-span-2">
                 <Input 
                    label="שם המשימה"
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    placeholder="לדוגמה: תשלום מע״מ"
                 />
             </div>
             
             <div className="md:col-span-2">
                 <label className="text-xs text-slate-400 font-medium mb-1 block">תיאור</label>
                 <textarea 
                    className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 h-24 resize-none"
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                 ></textarea>
             </div>

             <Select 
                label="עדיפות"
                options={[{value: 'High', label: 'גבוהה'}, {value: 'Medium', label: 'בינונית'}, {value: 'Low', label: 'נמוכה'}]}
                value={formData.priority}
                onChange={e => setFormData({...formData, priority: e.target.value as any})}
             />

            <Input 
                label="תאריך יעד"
                type="date"
                value={formData.dueDate}
                onChange={e => setFormData({...formData, dueDate: e.target.value})}
             />

            <Input 
                label="אחראי"
                value={formData.assignee}
                onChange={e => setFormData({...formData, assignee: e.target.value})}
             />

             <Select 
                label="ישות"
                options={entities.map(e => ({value: e.id, label: e.name}))}
                value={formData.entityId}
                onChange={e => setFormData({...formData, entityId: e.target.value})}
             />

             <div className="md:col-span-2 bg-slate-800/50 rounded-lg p-3 border border-slate-700 flex items-center justify-between">
                 <span className="text-sm text-slate-300">משימה מחזורית?</span>
                 <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                    <input 
                        type="checkbox" 
                        name="toggle" 
                        id="toggle" 
                        className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer"
                        checked={formData.isRecurring}
                        onChange={e => setFormData({...formData, isRecurring: e.target.checked})}
                        style={{right: formData.isRecurring ? '0' : 'auto', left: formData.isRecurring ? 'auto' : '0'}}
                    />
                    <label htmlFor="toggle" className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer ${formData.isRecurring ? 'bg-indigo-500' : 'bg-slate-600'}`}></label>
                </div>
             </div>

             {/* Recurring Settings Block - Added to match Transaction behavior */}
             {formData.isRecurring && (
                <div className="md:col-span-2 grid grid-cols-2 gap-4 bg-indigo-500/10 p-3 rounded-lg border border-indigo-500/20 animate-in fade-in slide-in-from-top-2">
                    <div className="md:col-span-2 text-xs font-bold text-indigo-300 mb-1 flex items-center gap-1">
                        <Repeat size={12} /> הגדרות מחזוריות
                    </div>
                    <Select 
                        label="תדירות" 
                        options={[{value: 'Monthly', label: 'חודשי'}, {value: 'Quarterly', label: 'רבעוני'}, {value: 'SemiAnnually', label: 'חצי שנתי'}, {value: 'Annually', label: 'שנתי'}]} 
                        value={formData.frequency || 'Monthly'} 
                        onChange={e => setFormData({...formData, frequency: e.target.value as Frequency})} 
                        className="bg-slate-900 border-indigo-500/30" 
                    />
                    <Select 
                        label="מועד חיוב" 
                        options={[{value: 'Specific', label: 'יום ספציפי בחודש'}, {value: 'SameAsStart', label: 'לפי תאריך התחלה'}, {value: 'LastDay', label: 'יום אחרון בחודש'}]} 
                        value={formData.recurringDayMode || 'SameAsStart'} 
                        onChange={e => setFormData({...formData, recurringDayMode: e.target.value as any})} 
                        className="bg-slate-900 border-indigo-500/30" 
                    />
                    {formData.recurringDayMode === 'Specific' && (
                        <Input 
                            label="יום בחודש (1-31)" 
                            type="number" 
                            min={1} 
                            max={31} 
                            value={formData.dayInMonth || 1} 
                            onChange={e => setFormData({...formData, dayInMonth: Number(e.target.value)})} 
                            className="bg-slate-900 border-indigo-500/30" 
                        />
                    )}
                </div>
             )}

             {/* Functional File Upload Section */}
             <div className="md:col-span-2 mt-2">
                 <input type="file" multiple ref={attachmentInputRef} className="hidden" onChange={handleFileSelect} />
                 
                 <div 
                     className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-slate-500 transition-all cursor-pointer min-h-[120px]
                     ${isDragging ? 'border-indigo-400 bg-indigo-500/10' : 'border-slate-700 hover:border-indigo-500/50 hover:bg-indigo-500/5'}`}
                     onClick={() => attachmentInputRef.current?.click()}
                     onDragOver={handleDragOver}
                     onDrop={handleDrop}
                 >
                    <Upload size={24} className="mb-2" />
                    <span className="text-sm font-medium">גרור קבצים לכאן או לחץ להעלאה</span>
                 </div>
                 
                 {/* Attachments List */}
                 {(formData.attachments?.length! > 0 || newAttachments.length > 0) && (
                     <div className="mt-3 space-y-2 max-h-[150px] overflow-y-auto pr-1">
                         {/* Existing */}
                         {formData.attachments?.map((att, idx) => (
                             <div key={`existing-${att.id}`} className="flex justify-between items-center bg-indigo-900/20 border border-indigo-500/20 rounded px-2 py-1.5">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <FileText size={12} className="text-indigo-400 shrink-0"/>
                                    <a 
                                        href={att.url} 
                                        download={att.name}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-xs text-indigo-100 truncate max-w-[200px] hover:text-white hover:underline cursor-pointer" 
                                        title={att.name}
                                    >
                                        {att.name}
                                    </a>
                                </div>
                                <button onClick={() => removeExistingAttachment(att.id)} className="text-indigo-400 hover:text-rose-400 p-1">
                                    <X size={12}/>
                                </button>
                             </div>
                         ))}
                         {/* New */}
                         {newAttachments.map((att, idx) => (
                             <div key={`new-${idx}`} className="flex justify-between items-center bg-slate-800 border border-slate-700 rounded px-2 py-1.5">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <FileText size={12} className="text-emerald-500 shrink-0"/>
                                    <a 
                                        href={att.url} 
                                        download={att.name}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-xs text-slate-200 truncate max-w-[200px] hover:text-white hover:underline cursor-pointer" 
                                        title={att.name}
                                    >
                                        {att.name}
                                    </a>
                                </div>
                                <button onClick={() => removeNewAttachment(idx)} className="text-slate-500 hover:text-rose-400 p-1"><X size={12}/></button>
                             </div>
                         ))}
                     </div>
                 )}
             </div>

         </div>
         <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-800">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>ביטול</Button>
            <Button onClick={handleSave}>שמור</Button>
        </div>
      </Modal>
    </div>
  );
};
