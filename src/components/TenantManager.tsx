import React, { useState, useEffect } from 'react';
import { Building2, Server, Key, Database, Plus, CheckCircle2, XCircle, AlertTriangle, Loader2, ArrowRight, ShieldCheck, ChevronRight } from 'lucide-react';
import PocketBase from 'pocketbase';
import { ConfigServiceLive } from '../lib/config';
import { Effect } from 'effect';

const configValues = Effect.runSync(ConfigServiceLive.loadAll());
const MAIN_POCKETBASE_URL = configValues.mainPocketBaseUrl;
const mainPb = new PocketBase(MAIN_POCKETBASE_URL);

interface Tenant {
  id: string;
  tenant_name: string;
  tenant_slug: string;
  status: string;
  created: string;
  db_url?: string;
}

export const TenantManager: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Wizard state
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    dbUrl: 'http://127.0.0.1:8090',
    adminEmail: 'admin@'
  });

  const fetchTenants = async () => {
    try {
      setIsLoading(true);
      setError(null);
      // Try to fetch tenants
      const records = await mainPb.collection('s_tenants').getFullList({
        sort: '-created',
      });
      
      // Fetch their DB URLs
      const enhancedTenants = await Promise.all(records.map(async (t) => {
        try {
          const props = await mainPb.collection('s_tenant_properties').getFullList({
            filter: `tenant_id="${t.id}" && property_key="TENANT_PROD_BASE_DB_URI"`
          });
          return {
            ...t,
            db_url: props.length > 0 ? props[0].property_value : 'Unknown'
          } as Tenant;
        } catch (e) {
          return { ...t, db_url: 'Unknown' } as Tenant;
        }
      }));
      
      setTenants(enhancedTenants);
    } catch (err: any) {
      console.warn("Could not fetch from central registry. Running in local fallback.", err);
      // Fallback local mock
      setTenants([
        {
          id: 'local-dev-id',
          tenant_name: 'Local Development Tenant',
          tenant_slug: 'local-dev',
          status: 'active',
          created: new Date().toISOString(),
          db_url: configValues.pocketBaseUrl
        }
      ]);
      setError("Central Registry DB is offline. Showing local mock data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      // 1. Create the tenant record
      const tenant = await mainPb.collection('s_tenants').create({
        tenant_name: formData.name,
        tenant_slug: formData.slug,
        status: 'active'
      });

      // 2. Create the properties
      await mainPb.collection('s_tenant_properties').create({
        tenant_id: tenant.id,
        property_key: 'TENANT_PROD_BASE_DB_URI',
        property_value: formData.dbUrl,
        is_secret: false
      });

      await mainPb.collection('s_tenant_properties').create({
        tenant_id: tenant.id,
        property_key: 'TENANT_REGION',
        property_value: 'us-east-1',
        is_secret: false
      });

      setSuccessMsg(`Successfully onboarded tenant: ${formData.name}`);
      setShowWizard(false);
      fetchTenants();
      setFormData({ name: '', slug: '', dbUrl: 'http://127.0.0.1:8090', adminEmail: 'admin@' });
    } catch (err: any) {
      setError(err.message || "Failed to create tenant");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter flex items-center gap-3">
            <Building2 className="text-indigo-500" size={36} />
            Enterprise Tenants
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium tracking-wide">
            Manage global tenant deployments, dedicated databases, and registry configurations.
          </p>
        </div>
        <button 
          onClick={() => setShowWizard(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-black shadow-lg shadow-indigo-500/30 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
        >
          <Plus size={20} />
          Onboard New Tenant
        </button>
      </header>

      {error && !showWizard && (
        <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 p-4 rounded-2xl flex items-center gap-3 border border-amber-200 dark:border-amber-800/30">
          <AlertTriangle size={20} />
          <span className="font-bold text-sm">{error}</span>
        </div>
      )}

      {successMsg && !showWizard && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 p-4 rounded-2xl flex items-center gap-3 border border-emerald-200 dark:border-emerald-800/30">
          <CheckCircle2 size={20} />
          <span className="font-bold text-sm">{successMsg}</span>
        </div>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-3xl p-6 border border-white/40 dark:border-slate-800/50 shadow-sm flex items-center gap-4 group">
          <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
            <Building2 size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Active Deployments</p>
            <p className="text-3xl font-black text-slate-900 dark:text-white">{tenants.length}</p>
          </div>
        </div>
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-3xl p-6 border border-white/40 dark:border-slate-800/50 shadow-sm flex items-center gap-4 group">
          <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
            <Server size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Registry Status</p>
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${error ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-3 w-3 ${error ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
              </span>
              <p className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">{error ? 'Offline (Local)' : 'Online'}</p>
            </div>
          </div>
        </div>
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-3xl p-6 border border-white/40 dark:border-slate-800/50 shadow-sm flex items-center gap-4 group">
          <div className="w-14 h-14 bg-blue-50 dark:bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
            <ShieldCheck size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Data Isolation</p>
            <p className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Enforced</p>
          </div>
        </div>
      </div>

      {/* Tenants List */}
      <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-2xl rounded-3xl border border-white/40 dark:border-slate-800/50 shadow-lg overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center items-center">
            <Loader2 className="animate-spin text-indigo-500" size={32} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-white/60 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-widest border-b border-white/40 dark:border-slate-800/50">
                <tr>
                  <th className="px-6 py-4">Tenant Identity</th>
                  <th className="px-6 py-4">Dedicated DB Endpoint</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {tenants.map(t => (
                  <tr key={t.id} className="hover:bg-white/60 dark:hover:bg-slate-800/40 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black shadow-md">
                          {t.tenant_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{t.tenant_name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">{t.tenant_slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/50 px-3 py-1.5 rounded-lg w-fit border border-slate-200 dark:border-slate-700">
                        <Database size={14} className="text-slate-400" />
                        <span className="font-mono">{t.db_url}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-500/10 rounded-full border border-emerald-100 dark:border-emerald-500/20 w-fit">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                        <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">{t.status}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-widest hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors flex items-center gap-1 ml-auto group-hover:translate-x-1 duration-300">
                        Manage <ChevronRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Onboard Wizard Modal */}
      {showWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] w-full max-w-3xl overflow-hidden shadow-2xl border border-white/20 dark:border-slate-700 animate-in zoom-in-95 duration-300">
            <div className="flex">
              {/* Left Panel */}
              <div className="w-1/3 bg-gradient-to-br from-indigo-600 to-purple-800 p-8 text-white hidden md:flex flex-col justify-between">
                <div>
                  <Building2 size={48} className="mb-6 opacity-80" />
                  <h2 className="text-2xl font-black tracking-tight mb-4">Enterprise Provisioning</h2>
                  <p className="text-indigo-100 text-sm leading-relaxed">
                    Setting up a new tenant provisions an isolated workspace and registers their dedicated backend infrastructure in the central registry.
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-sm font-bold text-indigo-200">
                    <CheckCircle2 size={16} className="text-emerald-400" /> Isolated Data
                  </div>
                  <div className="flex items-center gap-3 text-sm font-bold text-indigo-200">
                    <CheckCircle2 size={16} className="text-emerald-400" /> Custom DB Endpoint
                  </div>
                  <div className="flex items-center gap-3 text-sm font-bold text-indigo-200">
                    <CheckCircle2 size={16} className="text-emerald-400" /> Dedicated Channels
                  </div>
                </div>
              </div>
              
              {/* Right Panel (Form) */}
              <div className="flex-1 p-8 bg-slate-50 dark:bg-slate-900">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">Tenant Details</h3>
                  <button onClick={() => setShowWizard(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 bg-slate-200/50 dark:bg-slate-800 rounded-full transition-colors"><XCircle size={24} /></button>
                </div>
                
                <form onSubmit={handleCreateTenant} className="space-y-6">
                  {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-xl text-sm font-bold border border-red-200 dark:border-red-900/30">
                      {error}
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">Organization Name</label>
                    <input 
                      type="text" 
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-')})}
                      placeholder="e.g. Acme Corp"
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">Unique Slug (Identifier)</label>
                    <input 
                      type="text" 
                      required
                      value={formData.slug}
                      onChange={(e) => setFormData({...formData, slug: e.target.value})}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">Dedicated PocketBase URL</label>
                    <div className="relative">
                      <Server className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input 
                        type="url" 
                        required
                        value={formData.dbUrl}
                        onChange={(e) => setFormData({...formData, dbUrl: e.target.value})}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 pl-10 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
                      />
                    </div>
                  </div>

                  <div className="pt-6 mt-6 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-3 rounded-xl font-black flex items-center gap-2 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 shadow-xl shadow-slate-200 dark:shadow-none"
                    >
                      {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : 'Provision Tenant'}
                      {!isSubmitting && <ArrowRight size={18} />}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
