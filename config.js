// Supabase configuration
const SUPABASE_URL = 'https://cvlhkduzanwinkcegdst.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2bGhrZHV6YW53aW5rY2VnZHN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU4NDQ2MzksImV4cCI6MjA1MTQyMDYzOX0.hNGENjWE-oTtV5POoN1mdEzZnjOi4eT-d4AGsll_FCU'

// URL de redirecionamento baseada no ambiente
const SITE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001'
    : 'https://pixel-store.onrender.com';

console.log('Iniciando configuração do Supabase...');

// Initialize Supabase client
export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
        storageKey: 'pixel-store-auth',
        flowType: 'pkce',
        redirectTo: `${SITE_URL}/auth/callback`
    },
    global: {
        headers: {
            'Cache-Control': 'no-store'
        }
    }
});

console.log('Cliente Supabase inicializado com sucesso!');

// Teste de conexão
async function testConnection() {
    try {
        const { data, error } = await supabase.from('pixels').select('count');
        if (error) throw error;
        console.log('Conexão com Supabase testada com sucesso!', data);
    } catch (error) {
        console.error('Erro ao testar conexão:', error);
    }
}

// Testar conexão ao inicializar
testConnection();
