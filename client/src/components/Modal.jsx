import { FiX } from 'react-icons/fi';

export default function Modal({ isOpen, onClose, title, children, wide }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className={`bg-white rounded-xl shadow-xl ${wide ? 'w-[800px]' : 'w-[500px]'} max-h-[90vh] overflow-y-auto mx-4`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><FiX size={20} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
