import { useState, ReactNode } from 'react';
import { CreditCard, CheckCircle2, MessageSquare, ArrowRight, Loader2, KeyRound } from 'lucide-react';
import axios from 'axios';

export default function App() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'configuring' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  
  // Form State
  const [appName, setAppName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactNumber, setContactNumber] = useState('');

  const handleGupshupOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appName || !contactName || !contactEmail || !contactNumber) {
      setErrorMsg("Please fill in all fields.");
      return;
    }

    try {
      setLoading(true);
      setStatus('configuring');
      setErrorMsg('');

      // 1. Create App on Gupshup
      console.log("Step 1: Creating Gupshup App...");
      const createRes = await axios.post('/api/gupshup/app/create', { appName });
      const appId = createRes.data.appId || createRes.data.app?.id;
      
      if (!appId) throw new Error("Failed to retrieve App ID after creation.");

      // 2. Set Contact Details
      console.log("Step 2: Setting contact details...");
      await axios.put(`/api/gupshup/app/${appId}/contact`, {
        contactEmail,
        contactName,
        contactNumber
      });

      // 3. Generate Embed Sign-up Link
      console.log("Step 3: Generating Embed Link...");
      const linkRes = await axios.get(`/api/gupshup/app/${appId}/embed-link`, {
        params: { user: contactName, lang: 'en', regenerate: false }
      });

      const embedLink = linkRes.data.link;
      if (!embedLink) throw new Error("Did not receive a valid embed link from Gupshup.");

      // 4. Open POPUP
      console.log("Step 4: Opening Partnered Embedded Flow...", embedLink);
      window.open(embedLink, 'Whatsapp Signup', 'width=800,height=800,scrollbars=yes');

      setStatus('success');
      setLoading(false);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.response?.data?.error?.message || err.response?.data?.message || err.message || "An error occurred during onboarding.");
      setStatus('error');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center h-16 w-16 bg-[#25D366]/10 text-[#25D366] rounded-2xl mb-4 shadow-sm border border-[#25D366]/20">
            <MessageSquare size={32} strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-display font-semibold text-zinc-900 tracking-tight">
            WhatsApp Business Integration
          </h1>
          <p className="text-zinc-500 mt-2 text-lg">
            Connect your number via Gupshup Partner Portal and activate your credit line.
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 overflow-hidden">
          {status === 'idle' && (
            <div className="p-8 md:p-10">
              
              <div className="mb-8 grid sm:grid-cols-3 gap-4">
                 <FeatureRow icon={<CreditCard className="w-5 h-5 text-indigo-500" />} title="Partner API" />
                 <FeatureRow icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />} title="Credit Mgmt" />
                 <FeatureRow icon={<KeyRound className="w-5 h-5 text-amber-500" />} title="Full Control" />
              </div>

              <form onSubmit={handleGupshupOnboarding} className="space-y-4 pt-6 border-t border-zinc-100">
                <h3 className="font-semibold text-zinc-700 text-sm uppercase tracking-wide">Business Details</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">App Name</label>
                    <input 
                      type="text" 
                      value={appName}
                      onChange={(e) => setAppName(e.target.value)}
                      placeholder="My Business App"
                      className="w-full px-4 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Contact Name</label>
                    <input 
                      type="text" 
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full px-4 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Contact Email</label>
                      <input 
                        type="email" 
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="jane@example.com"
                        className="w-full px-4 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Contact Phone</label>
                      <input 
                        type="tel" 
                        value={contactNumber}
                        onChange={(e) => setContactNumber(e.target.value)}
                        placeholder="1234567890"
                        className="w-full px-4 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                        required
                      />
                    </div>
                  </div>
                </div>

                {errorMsg && (
                   <p className="text-red-500 text-sm mt-3">{errorMsg}</p>
                )}

                <div className="mt-8 pt-4 flex justify-end">
                  <button 
                    type="submit"
                    disabled={loading}
                    className="bg-zinc-900 hover:bg-zinc-800 text-white px-6 py-3 rounded-xl font-medium transition-all w-full md:w-auto inline-flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed shadow-sm border border-zinc-800"
                  >
                    {loading ? (
                      <><Loader2 className="animate-spin mr-2 h-5 w-5" /> Provisioning...</>
                    ) : (
                      <>Generate Embed Link <ArrowRight className="ml-2 h-5 w-5" /></>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {status === 'configuring' && (
            <div className="p-16 text-center">
              <Loader2 className="animate-spin w-12 h-12 text-[#25D366] mx-auto mb-6" />
              <h2 className="text-xl font-semibold text-zinc-900 mb-2">Provisioning App via Gupshup</h2>
              <p className="text-zinc-500 max-w-sm mx-auto">
                Setting up your application, linking contact details, and generating secure Meta signup URL...
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="p-12 text-center">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-emerald-50">
                <CheckCircle2 size={40} />
              </div>
              <h2 className="text-2xl font-bold text-zinc-900 mb-3">Onboarding Triggered</h2>
              <p className="text-zinc-600 mb-8 max-w-md mx-auto">
                Please complete the Facebook Embedded Setup in the new tab to link your WABA to Gupshup.
              </p>
              
              <button 
                onClick={() => { setStatus('idle'); setAppName(''); setContactName(''); setContactEmail(''); setContactNumber(''); }}
                className="bg-zinc-900 hover:bg-zinc-800 text-white px-8 py-3 rounded-xl font-medium transition-colors"
               >
                Setup another app
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-red-50">
                <span className="text-2xl font-bold">!</span>
              </div>
              <h2 className="text-xl font-bold text-zinc-900 mb-2">Integration Failed</h2>
              <p className="text-red-500 mb-8 max-w-md mx-auto text-sm bg-red-50 p-4 rounded-xl border border-red-100 font-mono text-left break-words">
                {typeof errorMsg === 'object' ? JSON.stringify(errorMsg, null, 2) : errorMsg}
              </p>
              <button 
                onClick={() => { setStatus('idle'); setErrorMsg(''); }}
                className="bg-white border-2 border-zinc-200 hover:border-zinc-300 text-zinc-700 px-6 py-2.5 rounded-xl font-medium transition-colors"
               >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FeatureRow({ icon, title }: { icon: ReactNode, title: string }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-xl border border-zinc-100">
      {icon}
      <h3 className="font-medium text-sm text-zinc-800">{title}</h3>
    </div>
  );
}
