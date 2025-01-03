// Função para salvar pixels no banco
async function savePixels(x, y, width, height, imagePath, userId) {
    return await supabase
        .from('pixels')
        .insert([{
            x,
            y,
            width,
            height,
            image_path: imagePath,
            user_id: userId
        }]);
}

// Função para registrar uma compra
async function registerPurchase(pixelCount, pricePerPixel, totalValue, imageId) {
    return await supabase
        .from('purchases')
        .insert([{
            pixel_count: pixelCount,
            price_per_pixel: pricePerPixel,
            total_value: totalValue,
            image_id: imageId
        }]);
}

// Função para carregar imagens existentes
async function loadExistingImages() {
    const { data: pixels, error } = await supabase
        .from('pixels')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Erro ao carregar pixels:', error);
        return;
    }

    return pixels;
}

// Função para atualizar os pixels comprados
async function updatePurchasedPixels(x, y, width, height, imageBase64) {
    try {
        const { data: pixels, error } = await supabase
            .from('pixels')
            .insert([
                {
                    x: x,
                    y: y,
                    width: width,
                    height: height,
                    image_data: imageBase64
                }
            ])
            .select();

        if (error) {
            console.error('Erro ao atualizar pixels:', error);
            throw error;
        }

        return pixels;
    } catch (error) {
        console.error('Erro ao atualizar pixels:', error);
        throw error;
    }
}
