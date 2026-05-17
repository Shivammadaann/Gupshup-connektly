import { useState, useEffect, ReactNode } from 'react';
import { CreditCard, CheckCircle2, MessageSquare, ArrowRight, Loader2, KeyRound } from 'lucide-react';
import axios from 'axios';

// Add types for FB SDK
declare global {
  interface Window {
    FB: any;
    fbLoaded: boolean;
    fbAsyncInit: () => void;
  }
}

export default function App() {
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<{ metaAppId: string; partnerId: string } | null>(null);
  const [status, setStatus] = useState<'idle' | 'configuring' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [onboardingData, setOnboardingData] = useState<any>(null);

  useEffect(() => {
    // Fetch configuration first
    axios.get('/api/config').then(res => {
      setConfig(res.data);
      if (window.FB && res.data.metaAppId) {
        initFb(res.data.metaAppId);
      } else if (window.fbLoaded && res.data.metaAppId) {
        initFb(res.data.metaAppId);
      } else {
        window.addEventListener('fbLoaded', () => initFb(res.data.metaAppId));
      }
    }).catch(err => {
      console.error(err);
      setErrorMsg("Failed to load environment configuration. Ensure META_APP_ID is set in the server.");
      setStatus('error');
    });
  }, []);

  const initFb = (appId: string) => {
    if (!window.FB) return;
    window.FB.init({
      appId: appId,
      autoLogAppEvents: true,
      xfbml: true,
      version: 'v18.0'
    });
  };

  const launchWhatsAppSignup = () => {
    if (!window.FB) {
      setErrorMsg("Facebook SDK not loaded. Try refreshing.");
      return;
    }
    
    setLoading(true);

    // Config according to WhatsApp Embedded Signup docs
    const sessionInfoVersion = '3';
    
    window.FB.login(
      function (response: any) {
        if (response.authResponse) {
          const code = response.authResponse.code;
          handleOnboardingCode(code);
        } else {
          setLoading(false);
          setErrorMsg("User cancelled login or didn't authorize fully.");
        }
      },
      {
        config_id: 'YOUR_CONFIG_ID_HERE', // Needs to be replaced with the actual config id if used
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: '',
          sessionInfoVersion: sessionInfoVersion,
        }
      }
    );
  };

  const handleOnboardingCode = async (code: string) => {
    try {
      setStatus('configuring');
      
      // We pass the oauth code/token and any other data we might have gleaned
      const res = await axios.post('/api/whatsapp/onboard', {
        code: code,
        waba_id: "example_waba_from_callback", // Typically retrieved from callback/webhooks 
      });
      
      const { appId } = res.data;
      setOnboardingData({ appId });
      
      // Auto assign credit
      await axios.post('/api/whatsapp/assign-credit', {
        appId: appId, 
        creditAmount: 50 // assigning $50 or 50 tokens
      });

      setStatus('success');
      setLoading(false);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || "An error occurred during onboarding.");
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
            Connect your number and instantly activate your $50 partner credit line.
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 overflow-hidden">
          {status === 'idle' && (
            <div className="p-8 md:p-10">
              <div className="space-y-6">
                <FeatureRow icon={<MessageSquare className="w-5 h-5 text-indigo-500" />} title="Connect WhatsApp" description="Link your business account using Meta's secure embedded flow." />
                <FeatureRow icon={<CreditCard className="w-5 h-5 text-emerald-500" />} title="Get $50 Credit Line" description="Your Gupshup wallet will be automatically credited to start messaging." />
                <FeatureRow icon={<KeyRound className="w-5 h-5 text-amber-500" />} title="Partner API Ready" description="All credentials provisioned securely in the background." />
              </div>

              <div className="mt-10 pt-8 border-t border-zinc-100 flex justify-end items-center gap-4">
                <button 
                  onClick={launchWhatsAppSignup}
                  disabled={loading || !config}
                  className="bg-[#1877F2] hover:bg-[#166FE5] text-white px-6 py-3 rounded-xl font-medium transition-all w-full md:w-auto inline-flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed shadow-sm border border-[#1877F2]/20"
                >
                  {loading ? (
                    <><Loader2 className="animate-spin mr-2 h-5 w-5" /> Connecting...</>
                  ) : (
                    <>Log in with Facebook <ArrowRight className="ml-2 h-5 w-5" /></>
                  )}
                </button>
              </div>
            </div>
          )}

          {status === 'configuring' && (
            <div className="p-16 text-center">
              <Loader2 className="animate-spin w-12 h-12 text-[#25D366] mx-auto mb-6" />
              <h2 className="text-xl font-semibold text-zinc-900 mb-2">Provisioning your workspace</h2>
              <p className="text-zinc-500 max-w-sm mx-auto">
                Setting up your Whatsapp Business API and assigning your credit limit via Gupshup Partner Network...
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="p-12 text-center">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-emerald-50">
                <CheckCircle2 size={40} />
              </div>
              <h2 className="text-2xl font-bold text-zinc-900 mb-3">All Set!</h2>
              <p className="text-zinc-600 mb-8 max-w-md mx-auto">
                Your WhatsApp number has been successfully verified and linked to Gupshup App <strong>{onboardingData?.appId}</strong>. We've added a $50 credit line to your wallet!
              </p>
              
              <button 
                onClick={() => window.location.reload()}
                className="bg-zinc-900 hover:bg-zinc-800 text-white px-8 py-3 rounded-xl font-medium transition-colors"
               >
                Go to Dashboard
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-red-50">
                <span className="text-2xl font-bold">!</span>
              </div>
              <h2 className="text-xl font-bold text-zinc-900 mb-2">Integration Failed</h2>
              <p className="text-red-500 mb-8 max-w-md mx-auto text-sm">
                {errorMsg}
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
        
        {config?.partnerId && (
          <p className="text-center text-xs text-zinc-400 mt-6 font-mono">
            Partner Network ID: {config.partnerId}
          </p>
        )}
      </div>
    </div>
  );
}

function FeatureRow({ icon, title, description }: { icon: ReactNode, title: string, description: string }) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-2xl hover:bg-zinc-50 transition-colors">
      <div className="mt-1 p-3 bg-white rounded-xl shadow-sm border border-zinc-100">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-zinc-900">{title}</h3>
        <p className="text-zinc-500 text-sm mt-1 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
