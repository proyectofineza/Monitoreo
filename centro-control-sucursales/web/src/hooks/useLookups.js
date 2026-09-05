import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

export function useBranches() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    supabase
      .from('branches')
      .select('*')
      .order('code')
      .then(({ data }) => {
        if (alive) {
          setBranches(data || []);
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  return { branches, loading, reload: () => setReloadKey((k) => k + 1) };
}

export function useIncidentTypes() {
  const [types, setTypes] = useState([]);
  useEffect(() => {
    supabase
      .from('incident_types')
      .select('*')
      .eq('active', true)
      .order('sort_order')
      .then(({ data }) => setTypes(data || []));
  }, []);
  return types;
}

export function useEmployees(branchId) {
  const [employees, setEmployees] = useState([]);
  useEffect(() => {
    let q = supabase.from('employees').select('*').eq('active', true).order('full_name');
    if (branchId) q = q.eq('branch_id', branchId);
    q.then(({ data }) => setEmployees(data || []));
  }, [branchId]);
  return employees;
}

export function useBranchScores() {
  const [scores, setScores] = useState({});
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase
      .from('branch_scores')
      .select('*')
      .then(({ data }) => {
        const map = {};
        (data || []).forEach((s) => (map[s.branch_id] = s));
        setScores(map);
        setLoading(false);
      });
  }, []);
  return { scores, loading };
}
