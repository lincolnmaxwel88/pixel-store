import { supabase } from './config.js'

// Upload de imagem para o Supabase Storage
export async function uploadImage(file) {
    try {
        console.log('Iniciando upload de imagem:', file.name);
        
        // Gerar nome único para o arquivo
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${fileName}`;

        // Fazer upload do arquivo
        const { data, error } = await supabase.storage
            .from('pixel-images')
            .upload(filePath, file);

        if (error) {
            console.error('Erro no upload:', error);
            throw error;
        }

        console.log('Upload realizado com sucesso:', data);

        // Obter URL pública do arquivo
        const { data: { publicUrl } } = supabase.storage
            .from('pixel-images')
            .getPublicUrl(filePath);

        console.log('URL pública gerada:', publicUrl);
        return { url: publicUrl, error: null };
    } catch (error) {
        console.error('Erro no upload:', error);
        return { url: null, error };
    }
}

// Salvar pixels no banco de dados
export async function savePixels(left, top, width, height, imageUrl) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            throw new Error('Usuário não autenticado');
        }

        // Inserir na tabela pixels
        const { data, error } = await supabase
            .from('pixels')
            .insert({
                user_id: user.id,
                x: left,
                y: top,
                width: width,
                height: height,
                image_url: imageUrl,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select();

        if (error) {
            console.error('Erro ao salvar pixels:', error);
            throw error;
        }

        return { data, error: null };
    } catch (error) {
        console.error('Erro ao salvar pixels:', error);
        return { data: null, error };
    }
}

export async function getAllPixels() {
    try {
        console.log('Buscando todos os pixels');
        
        const { data, error } = await supabase
            .from('pixels')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Erro ao buscar pixels:', error);
            throw error;
        }

        console.log('Pixels encontrados:', data?.length || 0);
        console.log('Primeiro pixel:', data?.[0]);
        
        return { data, error: null };
    } catch (error) {
        console.error('Erro ao buscar pixels:', error);
        return { data: null, error };
    }
}

export async function updatePixelUrl(pixelId, redirectUrl) {
    try {
        console.log('Atualizando URL do pixel:', pixelId);
        
        const { data, error } = await supabase
            .from('pixels')
            .update({ redirect_url: redirectUrl })
            .eq('id', pixelId)
            .select();

        if (error) {
            console.error('Erro ao atualizar URL:', error);
            throw error;
        }

        console.log('URL atualizada com sucesso:', data);
        return { data, error: null };
    } catch (error) {
        console.error('Erro ao atualizar URL:', error);
        return { data: null, error };
    }
}
