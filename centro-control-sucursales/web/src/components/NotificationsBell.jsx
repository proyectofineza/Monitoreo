import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { fmtRelative } from '../lib/format.js';
import { IconBell } from './icons.jsx';

export default function NotificationsBell() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    setItems(data || []);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('notifications-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        setItems((prev) => [payload.new, ...prev].slice(0, 20));
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [load]);

  useEffect(() => {
    function onClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const unread = items.filter((n) => !n.read).length;

  const markAllRead = async () => {
    const ids = items.filter((n) => !n.read).map((n) => n.id);
    if (ids.length === 0) return;
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    await supabase.from('notifications').update({ read: true }).in('id', ids);
  };

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg text-text2 hover:text-text hover:bg-surface2"
      >
        <IconBell />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red text-white text-[9.5px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[85vw] max-w-80 bg-surface border border-border rounded-xl shadow-xl z-20 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-[13px] font-semibold">Notificaciones</span>
            <button onClick={markAllRead} className="text-[11px] text-brand hover:underline">
              Marcar todas leídas
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 && <div className="px-4 py-6 text-center text-[12px] text-text3">Sin notificaciones.</div>}
            {items.map((n) => (
              <div key={n.id} className={`px-4 py-3 border-b border-bordersoft text-[12.5px] ${n.read ? 'opacity-60' : ''}`}>
                <div className="font-semibold text-red">🚨 {n.title}</div>
                <div className="text-text2 mt-0.5">{n.body}</div>
                <div className="text-text3 text-[11px] mt-1">{fmtRelative(n.created_at)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
