const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Adicionar headers de segurança
app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', `
        default-src 'self' http://localhost:3001 https://*.stripe.com;
        style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.stripe.com;
        font-src 'self' https://fonts.gstatic.com https://*.stripe.com;
        script-src 'self' 'unsafe-inline' https://unpkg.com https://*.stripe.com https://*.supabase.co;
        frame-src https://*.stripe.com;
        connect-src 'self' http://localhost:3001 https://*.stripe.com https://*.supabase.co https://api.stripe.com;
        img-src 'self' data: blob: https://*.stripe.com;
    `.replace(/\s+/g, ' ').trim());
    next();
});

// Endpoint para criar sessão de checkout
app.post('/create-checkout-session', async (req, res) => {
    try {
        const { pixelCount, totalValue } = req.body;
        
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: 'Pixel Purchase',
                            description: `Purchase of ${pixelCount} pixels`
                        },
                        unit_amount: Math.round(totalValue * 100), // Usar o valor total calculado no frontend
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${req.protocol}://${req.get('host')}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${req.protocol}://${req.get('host')}/cancel.html`,
        });

        res.json({ id: session.id });
    } catch (error) {
        console.error('Erro ao criar sessão:', error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint para verificar pagamento
app.get('/check-payment/:sessionId', async (req, res) => {
    try {
        const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
        res.json({ status: session.payment_status });
    } catch (error) {
        console.error('Erro ao verificar pagamento:', error);
        res.status(500).json({ error: 'Erro ao verificar pagamento' });
    }
});

// Rota padrão
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Rota de sucesso
app.get('/success', (req, res) => {
    res.sendFile(path.join(__dirname, 'success.html'));
});

// Rota de cancelamento
app.get('/cancel', (req, res) => {
    res.sendFile(path.join(__dirname, 'cancel.html'));
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
