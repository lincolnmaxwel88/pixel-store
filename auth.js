import { supabase } from './config.js'

// Variável global para armazenar o usuário atual
let currentUser = null;

// Funções de autenticação
export async function signInWithEmail(email, password) {
    return await supabase.auth.signInWithPassword({
        email,
        password
    });
}

export async function signUpWithEmail(email, password, firstName, lastName) {
    // Criar usuário
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                first_name: firstName,
                last_name: lastName
            }
        }
    });

    if (authError) throw authError;

    // Criar perfil do usuário
    const { error: profileError } = await supabase
        .from('profiles')
        .insert([
            {
                id: authData.user.id,
                first_name: firstName,
                last_name: lastName,
                email: email
            }
        ]);

    if (profileError) throw profileError;

    return { data: authData, error: null };
}

export async function signOut() {
    return await supabase.auth.signOut();
}

export async function getCurrentUser() {
    return await supabase.auth.getUser();
}

// Configurar listener para mudanças na autenticação
supabase.auth.onAuthStateChange((event, session) => {
    console.log('Auth state changed:', event);
    if (event === 'SIGNED_OUT') {
        // Limpar qualquer estado ou cache necessário
        localStorage.removeItem('supabase.auth.token');
    }
});
