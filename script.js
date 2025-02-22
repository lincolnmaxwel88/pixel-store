// Importar funções de autenticação e manipulação de pixels
import { supabase } from './config.js';
import { signInWithEmail, signUpWithEmail, signOut, getCurrentUser } from './auth.js';
import { savePixels, updatePixelUrl, getAllPixels, uploadImage } from './pixels.js';

// Configuração do grid
const GRID_WIDTH = 1000;
const GRID_HEIGHT = 600;
const PIXEL_SIZE = 10;
const COLS = GRID_WIDTH / PIXEL_SIZE;
const ROWS = GRID_HEIGHT / PIXEL_SIZE;
const PIXEL_PRICE = 0.1; // R$ 0,10 por pixel

// Estado global
let selectedPixels = [];
let isSelecting = false;
let startX, startY;
let currentUser = null;
let currentImageFile = null;
let editingPixelId = null;
let currentPixelPrice = 0.10; // Valor padrão
let touchStartX, touchStartY; // Novas variáveis para touch
let isTouching = false; // Flag para controle de toque

// Elementos do DOM
let grid;
let loginButton;
let loginModal;
let loginForm;
let registerForm;
let closeButton;
let infoBox;
let selectedPixelsCount;
let totalValue;
let userMenu;
let userMenuTrigger;
let userName;
let userEmail;
let adminSettingsModal;
let purchasesModal;
let linkModal;
let linkInput;

// Botao flutuante comprar
document.addEventListener("click", (event) => {
    const buyButton = document.getElementById("buyButton");

    // Atualiza a posição do botão com base nas coordenadas do clique
    buyButton.style.left = `${event.clientX}px`;
    buyButton.style.top = `${event.clientY}px`;

    // Exibe o botão
    buyButton.style.display = "block";
});


// Botao flutuante Selecionar Imagem
document.addEventListener("click", (event) => {
    // Captura o botão
    const button = document.getElementById("floatingImageButton");

    // Atualiza a posição do botão com base nas coordenadas do clique
    button.style.left = `${event.pageX}px`;
    button.style.top = `${event.pageY}px`;

    // Exibe o botão
    button.style.display = "block";
});
document.addEventListener("click", (event) => {
    const imageButton = document.getElementById("floatingImageButton");
    const buyButton = document.getElementById("buyButton");

    // Lógica para exibir apenas o botão apropriado
    if (selectedPixels.length > 0 && !currentImageFile) {
        // Caso: pixels selecionados, mas nenhuma imagem foi carregada
        imageButton.style.left = `${event.pageX}px`;
        imageButton.style.top = `${event.pageY}px`;
        imageButton.style.display = "block";
        buyButton.style.display = "none";
    } else if (currentImageFile) {
        // Caso: imagem já carregada
        buyButton.style.left = `${event.pageX}px`;
        buyButton.style.top = `${event.pageY}px`;
        buyButton.style.display = "block";
        imageButton.style.display = "none";
    } else {
        // Nenhuma condição atende (nenhum pixel selecionado)
        imageButton.style.display = "none";
        buyButton.style.display = "none";
    }
});



// Inicialização
async function initialize() {
    try {
        console.log('Iniciando aplicação...');

        // Inicializar elementos do DOM
        grid = document.getElementById('pixelGrid');
        loginButton = document.querySelector('.login-button');
        loginModal = document.getElementById('loginModal');
        loginForm = document.getElementById('loginForm');
        registerForm = document.getElementById('registerForm');
        closeButton = document.querySelector('.close-button');
        infoBox = document.getElementById('infoBox');
        selectedPixelsCount = document.getElementById('selectedPixelsCount');
        totalValue = document.getElementById('totalValue');

        // Elementos do menu do usuário
        userMenu = document.querySelector('.user-menu');
        userMenuTrigger = document.querySelector('.user-menu-trigger');
        userName = document.querySelector('.user-name');
        userEmail = document.querySelector('.user-email');

        // Elementos de modais
        adminSettingsModal = document.getElementById('adminSettingsModal');
        purchasesModal = document.getElementById('purchasesModal');
        linkModal = document.getElementById('linkModal');
        linkInput = document.getElementById('linkInput');

        console.log('Elementos do menu:', { userMenu, userMenuTrigger, userName, userEmail });

        // Configurar event listeners
        setupEventListeners();
        setupAdminSettings();
        setupPurchasesModal();
        setupLinkModal();

        // Criar grid
        createGrid();

        // Verificar autenticação
        await checkAuthState();

        // Carregar imagens existentes
        await loadExistingImages();

        console.log('Aplicação inicializada com sucesso!');
    } catch (error) {
        console.error('Erro na inicialização:', error);
    }
}

// Configurar Admin Settings
function setupAdminSettings() {
    const adminButton = document.querySelector('.admin-settings-button');
    const adminModal = document.getElementById('adminSettingsModal');
    const closeButton = adminModal.querySelector('.close-button');
    const saveButton = document.getElementById('saveSettingsButton');
    const priceInput = document.getElementById('pixelPrice');

    // Carregar valor atual
    loadCurrentPrice();

    // Abrir modal
    adminButton.addEventListener('click', () => {
        adminModal.classList.add('show');
    });

    // Fechar modal
    closeButton.addEventListener('click', () => {
        adminModal.classList.remove('show');
    });

    // Fechar ao clicar fora
    adminModal.addEventListener('click', (e) => {
        if (e.target === adminModal) {
            adminModal.classList.remove('show');
        }
    });

    // Salvar configurações
    saveButton.addEventListener('click', async () => {
        const newPrice = parseFloat(priceInput.value);
        if (isNaN(newPrice) || newPrice <= 0) {
            alert('Por favor, insira um valor válido maior que zero.');
            return;
        }

        try {
            const { error } = await supabase
                .from('settings')
                .upsert({ key: 'pixel_price', value: newPrice });

            if (error) throw error;

            // Atualizar preço atual e recalcular valor total
            currentPixelPrice = newPrice;
            updateInfoBox();

            alert('Valor por pixel atualizado com sucesso!');
            adminModal.classList.remove('show');

        } catch (error) {
            console.error('Erro ao salvar configurações:', error);
            alert('Erro ao salvar configurações. Por favor, tente novamente.');
        }
    });
}

// Carregar preço atual
async function loadCurrentPrice() {
    try {
        const priceInput = document.getElementById('pixelPrice');

        const { data, error } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'pixel_price')
            .single();

        if (error) throw error;

        if (data) {
            currentPixelPrice = data.value;
            if (priceInput) {
                priceInput.value = data.value;
            }
            // Atualizar valor total se houver pixels selecionados
            updateInfoBox();
        }
    } catch (error) {
        console.error('Erro ao carregar preço atual:', error);
    }
}

// Criar grid de pixels
function createGrid() {
    if (!grid) return;

    // Limpar grid existente
    grid.innerHTML = '';

    // Criar células do grid
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            const cell = document.createElement('div');
            cell.className = 'pixel';
            cell.style.position = 'absolute';
            cell.style.left = (col * PIXEL_SIZE) + 'px';
            cell.style.top = (row * PIXEL_SIZE) + 'px';
            cell.style.width = PIXEL_SIZE + 'px';
            cell.style.height = PIXEL_SIZE + 'px';
            cell.dataset.x = col * PIXEL_SIZE;
            cell.dataset.y = row * PIXEL_SIZE;
            grid.appendChild(cell);
        }
    }
}

// Configurar modal de compras
function setupPurchasesModal() {
    const purchasesButton = document.querySelector('.my-purchases-button');
    const modal = document.getElementById('purchasesModal');
    const closeButton = modal.querySelector('.close-button');

    // Abrir modal e carregar compras
    purchasesButton.addEventListener('click', async () => {
        modal.classList.add('show');
        await loadPurchases();
    });

    // Fechar modal
    closeButton.addEventListener('click', () => {
        modal.classList.remove('show');
    });

    // Fechar ao clicar fora
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
        }
    });
}

// Carregar histórico de compras
async function loadPurchases() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            throw new Error('Usuário não autenticado');
        }

        const purchasesList = document.getElementById('purchasesList');
        purchasesList.innerHTML = '<tr><td colspan="4">Carregando...</td></tr>';

        // Buscar compras do usuário atual
        const { data: purchases, error } = await supabase
            .from('purchases')
            .select('*')
            .eq('user_id', user.id)
            .order('purchase_date', { ascending: false });

        if (error) throw error;

        if (!purchases || purchases.length === 0) {
            purchasesList.innerHTML = '<tr><td colspan="4">Nenhuma compra encontrada</td></tr>';
            return;
        }

        purchasesList.innerHTML = purchases.map(purchase => {
            const pixelCount = purchase.pixels?.width * purchase.pixels?.height || 0;
            return `
                <tr>
                    <td>${new Date(purchase.purchase_date).toLocaleString('pt-BR')}</td>
                    <td>${purchase.pixel_count}</td>
                    <td>R$ ${(purchase.price_per_pixel).toFixed(2)}</td>
                    <td>R$ ${purchase.total_value.toFixed(2)}</td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error('Erro ao carregar compras:', error);
        purchasesList.innerHTML = '<tr><td colspan="4">Erro ao carregar compras</td></tr>';
    }
}

// Registrar uma nova compra
async function registerPurchase(purchaseData, sessionId) {
    try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        const purchase = {
            user_id: userData.user.id,
            x: purchaseData.x,
            y: purchaseData.y,
            width: purchaseData.width,
            height: purchaseData.height,
            image_data: purchaseData.imageBase64,
            pixel_count: purchaseData.pixelCount,
            total_value: purchaseData.totalValue,
            payment_id: sessionId,
            price_per_pixel: purchaseData.pricePerPixel
        };

        const { data, error } = await supabase
            .from('purchases')
            .insert([purchase])
            .select()
            .single();

        if (error) {
            console.error('Erro detalhado ao finalizar compra:', error);
            throw error;
        }

        return data;
    } catch (error) {
        console.error('Erro ao registrar compra:', error);
        throw error;
    }
}

// Event Listeners
function setupEventListeners() {
    // Login button
    if (loginButton) {
        // Remover evento anterior se existir
        loginButton.replaceWith(loginButton.cloneNode(true));
        // Pegar referência atualizada
        loginButton = document.querySelector('.login-button');
        // Adicionar novo evento
        loginButton.addEventListener('click', () => {
            loginModal.classList.add('show');
            loginForm.style.display = 'block';
            registerForm.style.display = 'none';
        });
    }

    // Close button
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            loginModal.classList.remove('show');
        });
    }

    // Switch between login and register
    document.getElementById('showRegister').addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
    });

    document.getElementById('showLogin').addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
    });

    // Login form
    if (loginForm) {
        loginForm.addEventListener('submit', handleLoginSubmit);
    }

    // Register form
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegisterSubmit);
    }

    // Grid event listeners
    if (grid) {
        grid.addEventListener('mousedown', handleMouseDown);
        grid.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        grid.addEventListener('touchstart', handleTouchStart, { passive: false });
        grid.addEventListener('touchmove', handleTouchMove, { passive: false });
        grid.addEventListener('touchend', handleTouchEnd, { passive: false });
    }

    // Manipulação de imagem
    const imageInput = document.getElementById('imageInput');
    if (imageInput) {
        imageInput.addEventListener('change', handleImageSelect);
    }

    // Menu do usuário
    setupUserMenuEvents();

    // Botão de logout
    const logoutButton = document.querySelector('.logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }
}

// Configurar eventos do menu do usuário
function setupUserMenuEvents() {
    console.log('Configurando eventos do menu');

    if (!userMenu) {
        console.error('Menu do usuário não encontrado');
        return;
    }

    // Remover eventos antigos
    const oldTrigger = userMenu.querySelector('.user-menu-trigger');
    if (oldTrigger) {
        console.log('Removendo trigger antigo');
        const newTrigger = oldTrigger.cloneNode(true);
        oldTrigger.parentNode.replaceChild(newTrigger, oldTrigger);
        userMenuTrigger = newTrigger;
    }

    // Adicionar novo evento de clique
    if (userMenuTrigger) {
        console.log('Adicionando evento de clique ao trigger');
        userMenuTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            userMenu.classList.toggle('active');
            console.log('Menu toggled:', userMenu.classList.contains('active'));
        });
    } else {
        console.error('Trigger do menu não encontrado');
    }

    // Fechar menu ao clicar fora
    document.addEventListener('click', (e) => {
        if (!userMenu.contains(e.target)) {
            userMenu.classList.remove('active');
        }
    });

    // Configurar botão de logout
    const logoutButton = userMenu.querySelector('.logout-button');
    if (logoutButton) {
        console.log('Configurando botão de logout');
        // Remover eventos antigos
        const newLogoutButton = logoutButton.cloneNode(true);
        logoutButton.parentNode.replaceChild(newLogoutButton, logoutButton);
        // Adicionar novo evento
        newLogoutButton.addEventListener('click', handleLogout);
    } else {
        console.error('Botão de logout não encontrado');
    }
}

// Função para alternar entre formulários de login e registro
function showLoginForm() {
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
}

function showRegisterForm() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
}

// Manipular envio do formulário de registro
async function handleRegisterSubmit(event) {
    event.preventDefault();
    
    const firstName = document.getElementById('registerFirstName').value;
    const lastName = document.getElementById('registerLastName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (password !== confirmPassword) {
        await Swal.fire({
            title: 'Erro',
            text: 'As senhas não coincidem',
            icon: 'error',
            confirmButtonText: 'OK'
        });
        return;
    }

    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    first_name: firstName,
                    last_name: lastName
                }
            }
        });

        if (error) throw error;

        // Limpar formulário
        document.getElementById('registerForm').reset();

        // Mostrar mensagem de sucesso e instruções
        await Swal.fire({
            title: 'Cadastro Realizado!',
            text: 'Um email de confirmação foi enviado para o seu endereço. Por favor, verifique sua caixa de entrada e confirme seu email antes de fazer login.',
            icon: 'success',
            confirmButtonText: 'OK'
        });

        // Mostrar formulário de login
        showLoginForm();

    } catch (error) {
        await Swal.fire({
            title: 'Erro no cadastro',
            text: error.message,
            icon: 'error',
            confirmButtonText: 'OK'
        });
    }
}

// Manipular envio do formulário de login
async function handleLoginSubmit(event) {
    event.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            if (error.message.includes('Email not confirmed')) {
                await Swal.fire({
                    title: 'Email não confirmado',
                    text: 'Por favor, confirme seu email antes de fazer login. Verifique sua caixa de entrada.',
                    icon: 'warning',
                    confirmButtonText: 'OK'
                });
            } else {
                await Swal.fire({
                    title: 'Erro no login',
                    text: error.message,
                    icon: 'error',
                    confirmButtonText: 'OK'
                });
            }
            return;
        }

        // Fechar modal de login
        const loginModal = document.getElementById('loginModal');
        if (loginModal) {
            loginModal.style.display = 'none';
        }

        // Atualizar UI
        updateUIForLoggedUser(data.user);

    } catch (error) {
        await Swal.fire({
            title: 'Erro no login',
            text: error.message,
            icon: 'error',
            confirmButtonText: 'OK'
        });
    }
}

// Event listeners para os formulários
document.getElementById('registerForm').addEventListener('submit', handleRegisterSubmit);
document.getElementById('loginForm').addEventListener('submit', handleLoginSubmit);

// Event listeners para alternar entre formulários
document.getElementById('showRegister').addEventListener('click', (e) => {
    e.preventDefault();
    showRegisterForm();
});

document.getElementById('showLogin').addEventListener('click', (e) => {
    e.preventDefault();
    showLoginForm();
});

// Handlers de mouse
function handleMouseDown(e) {
    if (!currentUser) {
        alert('Faça login para selecionar pixels');
        loginModal.classList.add('show');
        return;
    }

    if (e.button === 0) { // Botão esquerdo
        const rect = grid.getBoundingClientRect();
        startX = Math.floor((e.clientX - rect.left) / PIXEL_SIZE) * PIXEL_SIZE;
        startY = Math.floor((e.clientY - rect.top) / PIXEL_SIZE) * PIXEL_SIZE;

        // Verificar se o pixel inicial está disponível
        if (isPixelPurchased(startX, startY)) {
            return;
        }

        isSelecting = true;
        clearSelection();
        createSelectionBox(startX, startY);
    }
}

function handleMouseMove(e) {
    if (!isSelecting) return;

    const rect = grid.getBoundingClientRect();
    const currentX = Math.floor((e.clientX - rect.left) / PIXEL_SIZE) * PIXEL_SIZE;
    const currentY = Math.floor((e.clientY - rect.top) / PIXEL_SIZE) * PIXEL_SIZE;

    // Limitar as coordenadas ao grid
    const boundedX = Math.max(0, Math.min(currentX, GRID_WIDTH - PIXEL_SIZE));
    const boundedY = Math.max(0, Math.min(currentY, GRID_HEIGHT - PIXEL_SIZE));

    updateSelectionBox(boundedX, boundedY);
}

function handleMouseUp() {
    if (isSelecting) {
        isSelecting = false;
        if (selectedPixels.length > 0) {
            showFloatingButtons();
        }
    }
}

// Funções de seleção
function createSelectionBox(x, y) {
    const selectionBox = document.createElement('div');
    selectionBox.className = 'selection-box';
    selectionBox.style.left = x + 'px';
    selectionBox.style.top = y + 'px';
    grid.appendChild(selectionBox);
}

function updateSelectionBox(currentX, currentY) {
    const selectionBox = grid.querySelector('.selection-box');
    if (!selectionBox) return;

    // Calcular dimensões da seleção
    const left = Math.min(currentX, startX);
    const top = Math.min(currentY, startY);
    const right = Math.max(currentX, startX) + PIXEL_SIZE;
    const bottom = Math.max(currentY, startY) + PIXEL_SIZE;
    const width = right - left;
    const height = bottom - top;

    // Verificar se há pixels comprados na área
    if (hasAnyPurchasedPixelsInArea(left, top, width, height)) {
        clearSelection();
        return;
    }

    // Atualizar visual da seleção
    selectionBox.style.left = left + 'px';
    selectionBox.style.top = top + 'px';
    selectionBox.style.width = width + 'px';
    selectionBox.style.height = height + 'px';

    // Atualizar seleção
    selectedPixels = [{
        left,
        top,
        width,
        height
    }];

    // Atualizar informações
    updateInfoBox();
}

function clearSelection() {
    const selectionBox = grid.querySelector('.selection-box');
    if (selectionBox) {
        selectionBox.remove();
    }
    selectedPixels = [];
    hideFloatingButtons();
    hideInfoBox();
}

// Funções dos botões flutuantes
function showFloatingButtons() {
    const existingButtons = document.querySelector('.floating-buttons');
    if (existingButtons) {
        existingButtons.remove();
    }

    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'floating-buttons';

    // Botão de selecionar imagem
    const imageButton = document.createElement('button');
    imageButton.id = 'floatingImageButton';
    imageButton.textContent = 'Selecionar Imagem';
    imageButton.onclick = () => imageInput.click();

    // Botão de compra
    const buyButton = document.createElement('button');
    buyButton.id = 'buyButton';
    buyButton.textContent = 'Comprar Pixels';
    buyButton.onclick = handlePurchase;
    buyButton.style.display = 'none';

    buttonsContainer.appendChild(imageButton);
    buttonsContainer.appendChild(buyButton);
    document.body.appendChild(buttonsContainer);
}

function hideFloatingButtons() {
    const buttonsContainer = document.querySelector('.floating-buttons');
    if (buttonsContainer) {
        buttonsContainer.style.display = 'none';
    }
}

// Funções de manipulação de imagem
function handleImageSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    currentImageFile = file;

    // Mostrar botão de compra
    const imageButton = document.getElementById('floatingImageButton');
    const buyButton = document.getElementById('buyButton');

    if (imageButton && buyButton) {
        imageButton.style.display = 'none';
        buyButton.style.display = 'block';
    }
}

async function handlePurchase() {
    try {
        // 1. Verificar login
        if (!currentUser) {
            alert('Por favor, faça login para comprar pixels.');
            return;
        }

        // 2. Verificar seleção
        if (!selectedPixels || selectedPixels.length === 0) {
            alert('Por favor, selecione uma área primeiro.');
            return;
        }

        // 3. Verificar se tem imagem selecionada
        if (!currentImageFile) {
            alert('Por favor, selecione uma imagem primeiro.');
            return;
        }

        // 4. Obter dimensões da seleção
        const selection = selectedPixels[0];
        const gridX = selection.left;
        const gridY = selection.top;
        const pixelWidth = selection.width;
        const pixelHeight = selection.height;

        // 5. Verificar se área está disponível
        if (hasAnyPurchasedPixelsInArea(gridX, gridY, pixelWidth, pixelHeight)) {
            alert('Alguns pixels nesta área já foram comprados. Por favor, selecione outra área.');
            return;
        }

        // 6. Calcular preço
        const pixelCount = Math.floor((pixelWidth * pixelHeight) / 100);
        const pricePerPixel = currentPixelPrice; // Preço atual do Admin Settings
        const totalValue = pixelCount * pricePerPixel;

        // 7. Confirmar compra
        if (!confirm(`Confirmar compra de ${pixelCount} pixels por R$ ${totalValue.toFixed(2)}?`)) {
            return;
        }

        // Guardar informações da compra temporariamente
        const reader = new FileReader();
        reader.onload = async function(e) {
            const purchaseInfo = {
                userId: currentUser.id,
                x: gridX,
                y: gridY,
                width: pixelWidth,
                height: pixelHeight,
                imageBase64: e.target.result,
                pixelCount,
                totalValue,
                pricePerPixel
            };
            localStorage.setItem('pendingPurchase', JSON.stringify(purchaseInfo));

            // Criar sessão de checkout no Stripe
            const response = await fetch('http://localhost:3001/create-checkout-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    pixelCount,
                    totalValue,
                }),
            });

            const { id } = await response.json();
            if (!id) {
                throw new Error('Não foi possível criar a sessão de checkout');
            }

            // Carregar o Stripe.js
            const stripe = await loadStripe('pk_test_51QbVcLKxtlwVKoGi1mssIKeOby7ZtYayRV9ZdE9aXJkbeK00RKHbExzi8lvcnuomDOhdNoJFoh5lCmV3MwTKBLWV00KRz3Fpue');
            
            // Redirecionar para o checkout
            const { error } = await stripe.redirectToCheckout({
                sessionId: id
            });

            if (error) {
                console.error('Erro ao redirecionar para o checkout:', error);
                throw error;
            }
        };
        reader.readAsDataURL(currentImageFile);
    } catch (error) {
        console.error('Erro ao processar compra:', error);
        alert('Erro ao processar compra. Por favor, tente novamente.');
    }
}

// Função para verificar o status do pagamento e finalizar a compra
async function checkPaymentAndFinalizePurchase(sessionId) {
    try {
        // Recuperar dados da compra do localStorage
        const purchaseData = JSON.parse(localStorage.getItem('pendingPurchase'));
        if (!purchaseData) {
            throw new Error('Dados da compra não encontrados');
        }

        // Registrar a compra no Supabase
        await registerPurchase(purchaseData, sessionId);

        // Limpar dados do localStorage
        localStorage.removeItem('pendingPurchase');

        // Mostrar mensagem de sucesso
        await Swal.fire({
            title: 'Compra Finalizada!',
            text: 'Sua compra foi processada com sucesso.',
            icon: 'success',
            confirmButtonText: 'OK'
        });

        // Redirecionar para a página principal
        window.location.href = '/';
    } catch (error) {
        console.error('Erro ao finalizar compra:', error);
        await Swal.fire({
            title: 'Erro',
            text: 'Ocorreu um erro ao finalizar sua compra. Por favor, tente novamente.',
            icon: 'error',
            confirmButtonText: 'OK'
        });
    }
}

// Verificar se é uma página de sucesso de pagamento
console.log('Verificando página atual:', window.location.pathname);
if (window.location.pathname === '/success') {
    console.log('Estamos na página de sucesso!');
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    console.log('Session ID:', sessionId);
    if (sessionId) {
        checkPaymentAndFinalizePurchase(sessionId);
    }
}

// Funções de criação de imagem
function createImageContainer(x, y, width, height, imageUrl, redirectUrl = null, pixelId = null, isOwner = false) {
    console.log('Criando container:', { x, y, width, height, imageUrl, redirectUrl, pixelId, isOwner });

    const container = document.createElement('div');
    container.className = 'pixel-image-container';
    container.style.left = x + 'px';
    container.style.top = y + 'px';
    container.style.width = width + 'px';
    container.style.height = height + 'px';

    if (pixelId) {
        container.dataset.pixelId = pixelId;
    }
    if (redirectUrl) {
        container.dataset.redirectUrl = redirectUrl;
    }

    const img = document.createElement('img');
    img.className = 'pixel-image';
    img.src = imageUrl;
    img.onerror = () => {
        console.error('Erro ao carregar imagem:', imageUrl);
        img.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBkPSJNMTIgMkM2LjQ4IDIgMiA2LjQ4IDIgMTJzNC40OCAxMCAxMCAxMC01LjQ4IDEwLTEwUzE3LjUyIDIgMTIgMnptMSAxNWgtMlYtMmgydjJ6bTAtNGgtMlY3aDJ2NnoiLz48L3N2Zz4=';
    };

    // Criar ícone de link apenas se o usuário for o dono
    if (isOwner) {
        const linkIcon = document.createElement('div');
        linkIcon.className = 'link-icon';
        linkIcon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>';

        // Adicionar evento de clique no ícone
        linkIcon.addEventListener('click', (e) => {
            e.stopPropagation(); // Impede que o clique propague para o container
            showLinkModal(container.dataset.pixelId);
        });

        container.appendChild(linkIcon);
    }

    // Adicionar evento de clique no container
    container.addEventListener('click', (e) => handlePixelClick(e, container));

    container.appendChild(img);

    console.log('Container criado com sucesso');
    return container;
}

// Função para lidar com clique no container do pixel
function handlePixelClick(e, container) {
    // Se clicou no ícone de link, não redirecionar
    if (e.target.closest('.link-icon')) {
        const pixelId = container.dataset.pixelId;
        const currentLink = container.dataset.redirectUrl || '';
        showLinkModal(pixelId, currentLink);
        return;
    }

    // Se tem URL, redirecionar
    const url = container.dataset.redirectUrl;
    if (url) {
        window.open(url, '_blank');
    }
}

// Carregar pixels do banco
async function loadExistingImages() {
    try {
        console.log('Iniciando carregamento de pixels');
        const { data: pixels, error } = await getAllPixels();

        if (error) {
            console.error('Erro ao buscar pixels:', error);
            throw error;
        }

        // Verificar usuário atual
        const { data: { user } } = await supabase.auth.getUser();

        // Limpar pixels existentes
        const existingContainers = grid.querySelectorAll('.pixel-image-container');
        existingContainers.forEach(container => container.remove());

        if (!pixels || pixels.length === 0) {
            console.log('Nenhum pixel encontrado no banco');
            return;
        }

        console.log(`Carregando ${pixels.length} pixels`);

        // Criar um fragmento para melhor performance
        const fragment = document.createDocumentFragment();

        pixels.forEach(pixel => {
            if (!pixel.image_url) {
                console.warn('Pixel sem URL de imagem:', pixel);
                return;
            }

            console.log('Criando container para pixel:', pixel);

            const container = createImageContainer(
                pixel.x,
                pixel.y,
                pixel.width,
                pixel.height,
                pixel.image_url,
                pixel.redirect_url,
                pixel.id,
                user && pixel.user_id === user.id // Passa se o usuário é dono
            );

            fragment.appendChild(container);

            // Marcar pixels como comprados
            markPixelsAsPurchased(
                pixel.x,
                pixel.y,
                pixel.width,
                pixel.height
            );
        });

        // Adicionar todos os containers de uma vez
        grid.appendChild(fragment);

        console.log('Pixels carregados com sucesso');
    } catch (error) {
        console.error('Erro ao carregar pixels:', error);
    }
}

// Função auxiliar para carregar imagem
function loadImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Função para redimensionar imagem mantendo proporção
async function resizeImage(img, targetWidth, targetHeight) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Calcular as dimensões mantendo a proporção
    let newWidth = img.width;
    let newHeight = img.height;
    const ratio = Math.min(targetWidth / img.width, targetHeight / img.height);

    newWidth *= ratio;
    newHeight *= ratio;

    // Configurar canvas com as dimensões do container
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    // Preencher fundo branco
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Desenhar imagem centralizada
    const x = (targetWidth - newWidth) / 2;
    const y = (targetHeight - newHeight) / 2;
    ctx.drawImage(img, x, y, newWidth, newHeight);

    // Converter para Blob
    return new Promise(resolve => {
        canvas.toBlob(blob => {
            resolve(blob);
        }, 'image/png');
    });
}

// Funções auxiliares
function getPixelAt(x, y) {
    return Array.from(grid.querySelectorAll('.pixel')).find(pixel =>
        parseInt(pixel.dataset.x) === x &&
        parseInt(pixel.dataset.y) === y
    );
}

function isPixelPurchased(x, y) {
    const col = Math.floor(x / PIXEL_SIZE);
    const row = Math.floor(y / PIXEL_SIZE);
    const pixel = getPixelAt(col * PIXEL_SIZE, row * PIXEL_SIZE);
    return pixel && pixel.classList.contains('purchased');
}

function hasAnyPurchasedPixelsInArea(left, top, width, height) {
    const startCol = Math.floor(left / PIXEL_SIZE);
    const startRow = Math.floor(top / PIXEL_SIZE);
    const endCol = Math.ceil((left + width) / PIXEL_SIZE);
    const endRow = Math.ceil((top + height) / PIXEL_SIZE);

    for (let row = startRow; row < endRow; row++) {
        for (let col = startCol; col < endCol; col++) {
            if (isPixelPurchased(col * PIXEL_SIZE, row * PIXEL_SIZE)) {
                return true;
            }
        }
    }
    return false;
}

function markPixelsAsPurchased(left, top, width, height) {
    const startCol = Math.floor(left / PIXEL_SIZE);
    const startRow = Math.floor(top / PIXEL_SIZE);
    const endCol = Math.ceil((left + width) / PIXEL_SIZE);
    const endRow = Math.ceil((top + height) / PIXEL_SIZE);

    for (let row = startRow; row < endRow; row++) {
        for (let col = startCol; col < endCol; col++) {
            const pixel = getPixelAt(col * PIXEL_SIZE, row * PIXEL_SIZE);
            if (pixel) {
                pixel.classList.add('purchased');
            }
        }
    }
}

// Funções do box de informações
function updateInfoBox() {
    if (!infoBox) return;

    // Calcular número total de pixels na seleção
    let totalPixels = 0;
    selectedPixels.forEach(selection => {
        // Dividir por 100 para corrigir a exibição
        totalPixels += Math.floor((selection.width * selection.height) / 100);
    });
    
    // Como cada pixel custa R$ 1,00, o total é igual ao número de pixels
    const total = totalPixels * currentPixelPrice;

    selectedPixelsCount.textContent = totalPixels;
    totalValue.textContent = `R$ ${total.toFixed(2)}`;

    if (totalPixels > 0) {
        infoBox.classList.add('show');
    } else {
        infoBox.classList.remove('show');
    }
}

function showInfoBox() {
    infoBox.classList.add('show');
}

function hideInfoBox() {
    infoBox.classList.remove('show');
}

// Verificar estado de autenticação
async function checkAuthState() {
    try {
        console.log('Verificando estado de autenticação...');
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError) {
            console.error('Erro ao verificar autenticação:', authError);
            updateUIForLoggedOutUser();
            return;
        }

        if (!user) {
            console.log('Nenhum usuário autenticado');
            updateUIForLoggedOutUser();
            return;
        }

        console.log('Usuário autenticado:', user);

        // Buscar o perfil pelo email em vez do ID
        const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', user.email);

        if (profileError) {
            console.error('Erro ao buscar perfil:', profileError);
            updateUIForLoggedOutUser();
            return;
        }

        const profile = profiles && profiles[0];
        
        if (!profile) {
            console.error('Perfil não encontrado para o email:', user.email);
            updateUIForLoggedOutUser();
            return;
        }

        console.log('Perfil encontrado:', profile);
        
        // Atualizar UI com os dados do perfil
        currentUser = user;
        updateUIForLoggedUser(profile);
    } catch (error) {
        console.error('Erro ao verificar estado:', error);
        updateUIForLoggedOutUser();
    }
}

// Logout
async function handleLogout() {
    try {
        await supabase.auth.signOut();
        currentUser = null;
        updateUIForLoggedOutUser();

        // Limpar qualquer cache local
        localStorage.removeItem('supabase.auth.token');
        sessionStorage.clear();

        // Recarregar a página para garantir um estado limpo
        window.location.reload();
    } catch (error) {
        console.error('Erro no logout:', error);
        alert('Erro ao fazer logout: ' + error.message);
    }
}

// Configurar modal de link
function setupLinkModal() {
    if (!linkModal) {
        console.error('Modal de link não encontrado');
        return;
    }

    const closeButton = linkModal.querySelector('.close-button');
    const saveButton = document.getElementById('saveLinkButton');
    const cancelButton = document.getElementById('cancelLinkButton');

    closeButton.addEventListener('click', hideLinkModal);
    cancelButton.addEventListener('click', hideLinkModal);

    saveButton.addEventListener('click', async () => {
        const link = linkInput.value.trim();
        if (!link) {
            alert('Por favor, insira um link válido');
            return;
        }

        try {
            await saveLinkToPixel(link);
            hideLinkModal();
        } catch (error) {
            console.error('Erro ao salvar link:', error);
            alert('Erro ao salvar link. Por favor, tente novamente.');
        }
    });
}

// Salvar link para o pixel
async function saveLinkToPixel(url) {
    try {
        // Verificar se o usuário está logado
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            alert('Por favor, faça login para alterar o link da imagem.');
            return;
        }

        // Verificar se o usuário é o dono do pixel
        const { data: pixel, error: pixelError } = await supabase
            .from('pixels')
            .select('user_id')
            .eq('id', editingPixelId)
            .single();

        if (pixelError) throw pixelError;

        // Se o pixel não pertence ao usuário atual, não permitir alteração
        if (pixel.user_id !== user.id) {
            alert('Você só pode alterar o link de imagens que você comprou.');
            return;
        }

        // Se chegou aqui, o usuário é o dono do pixel
        const { error } = await supabase
            .from('pixels')
            .update({ redirect_url: url })
            .eq('id', editingPixelId);

        if (error) throw error;

        // Atualizar o dataset do container
        const container = document.querySelector(`[data-pixel-id="${editingPixelId}"]`);
        if (container) {
            container.dataset.redirectUrl = url;
        }

        hideLinkModal();
        alert('Link salvo com sucesso!');

    } catch (error) {
        console.error('Erro ao salvar link:', error);
        alert('Erro ao salvar link. Por favor, tente novamente.');
    }
}

// Mostrar modal de link
async function showLinkModal(pixelId, currentLink = '') {
    if (!linkModal) {
        console.error('Modal de link não encontrado');
        return;
    }

    try {
        // Verificar se o usuário está logado
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            alert('Por favor, faça login para alterar o link da imagem.');
            return;
        }

        // Buscar o pixel e verificar se o usuário é o dono
        const { data: pixel, error } = await supabase
            .from('pixels')
            .select('redirect_url, user_id')
            .eq('id', pixelId)
            .single();

        if (error) throw error;

        // Se o pixel não pertence ao usuário atual, não permitir alteração
        if (pixel.user_id !== user.id) {
            alert('Você só pode alterar o link de imagens que você comprou.');
            return;
        }

        // Se chegou aqui, o usuário é o dono do pixel
        editingPixelId = pixelId;
        linkInput.value = pixel.redirect_url || '';
        linkModal.classList.add('show');
        linkInput.focus();
    } catch (error) {
        console.error('Erro ao carregar link atual:', error);
        alert('Erro ao carregar link atual. Por favor, tente novamente.');
    }
}

// Esconder modal de link
function hideLinkModal() {
    if (!linkModal) return;

    linkModal.classList.remove('show');
    linkInput.value = '';
    editingPixelId = null;
}

// Atualizar UI para usuário logado
async function updateUIForLoggedUser(user) {
    try {
        // Buscar perfil do usuário
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error) throw error;

        // Atualizar menu do usuário
        const userMenu = document.querySelector('.user-menu');
        const loginButton = document.querySelector('.login-button');
        const userName = document.querySelector('.user-name');
        const userEmail = document.querySelector('.user-email');
        const adminSettingsButton = document.querySelector('.admin-settings-button');

        if (userMenu && loginButton && userName && userEmail) {
            loginButton.style.display = 'none';
            userMenu.style.display = 'block';
            userName.textContent = `${profile.first_name} ${profile.last_name}`;
            userEmail.textContent = user.email;

            // Exibir ou ocultar botão de Admin Settings baseado no perfil
            if (adminSettingsButton) {
                adminSettingsButton.style.display = profile.admin ? 'block' : 'none';
            }
        }

        currentUser = user;
    } catch (error) {
        console.error('Erro ao atualizar UI:', error);
    }
}

// Atualizar UI para usuário deslogado
function updateUIForLoggedOutUser() {
    const userMenu = document.querySelector('.user-menu');
    const loginButton = document.querySelector('.login-button');
    const adminSettingsButton = document.querySelector('.admin-settings-button');

    if (userMenu && loginButton) {
        loginButton.style.display = 'block';
        userMenu.style.display = 'none';
    }

    // Garantir que o botão de Admin Settings esteja oculto
    if (adminSettingsButton) {
        adminSettingsButton.style.display = 'none';
    }

    currentUser = null;
}

// Funções de eventos touch
function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = grid.getBoundingClientRect();
    const scale = rect.width / GRID_WIDTH; // Calcula a escala atual do grid
    
    // Ajusta as coordenadas com base na escala
    const x = (touch.clientX - rect.left) / scale;
    const y = (touch.clientY - rect.top) / scale;
    
    startX = Math.floor(x / PIXEL_SIZE) * PIXEL_SIZE;
    startY = Math.floor(y / PIXEL_SIZE) * PIXEL_SIZE;
    
    isSelecting = true;
    selectedPixels = [];
    
    // Criar caixa de seleção inicial
    const selectionBox = document.createElement('div');
    selectionBox.className = 'selection-box';
    selectionBox.style.left = startX + 'px';
    selectionBox.style.top = startY + 'px';
    selectionBox.style.width = PIXEL_SIZE + 'px';
    selectionBox.style.height = PIXEL_SIZE + 'px';
    grid.appendChild(selectionBox);
    
    showInfoBox();
}

function handleTouchMove(e) {
    if (!isSelecting) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    const rect = grid.getBoundingClientRect();
    const scale = rect.width / GRID_WIDTH;
    
    // Ajusta as coordenadas com base na escala
    const currentX = (touch.clientX - rect.left) / scale;
    const currentY = (touch.clientY - rect.top) / scale;
    
    // Limita as coordenadas ao grid
    const boundedX = Math.max(0, Math.min(currentX, GRID_WIDTH));
    const boundedY = Math.max(0, Math.min(currentY, GRID_HEIGHT));
    
    // Calcula a área de seleção
    const left = Math.min(startX, Math.floor(boundedX / PIXEL_SIZE) * PIXEL_SIZE);
    const top = Math.min(startY, Math.floor(boundedY / PIXEL_SIZE) * PIXEL_SIZE);
    const right = Math.max(startX, Math.ceil(boundedX / PIXEL_SIZE) * PIXEL_SIZE);
    const bottom = Math.max(startY, Math.ceil(boundedY / PIXEL_SIZE) * PIXEL_SIZE);
    
    // Atualiza a caixa de seleção
    const selectionBox = grid.querySelector('.selection-box');
    if (selectionBox) {
        selectionBox.style.left = left + 'px';
        selectionBox.style.top = top + 'px';
        selectionBox.style.width = (right - left) + 'px';
        selectionBox.style.height = (bottom - top) + 'px';
    }
    
    // Atualiza os pixels selecionados
    selectedPixels = [];
    for (let y = top; y < bottom; y += PIXEL_SIZE) {
        for (let x = left; x < right; x += PIXEL_SIZE) {
            if (!hasAnyPurchasedPixelsInArea(x, y, PIXEL_SIZE, PIXEL_SIZE)) {
                selectedPixels.push({ x, y });
            }
        }
    }
    
    updateInfoBox();
}

function handleTouchEnd(e) {
    if (!isSelecting) return;
    e.preventDefault();
    
    isSelecting = false;
    
    // Remove a caixa de seleção
    const selectionBox = grid.querySelector('.selection-box');
    if (selectionBox) {
        selectionBox.remove();
    }
    
    // Se houver pixels selecionados, mostra os botões flutuantes
    if (selectedPixels.length > 0) {
        showFloatingButtons();
    } else {
        hideFloatingButtons();
    }
    
    updateInfoBox();
}

// Adiciona estilos CSS para a caixa de seleção
const style = document.createElement('style');
style.textContent = `
    .selection-box {
        position: absolute;
        border: 2px solid #007bff;
        background-color: rgba(0, 123, 255, 0.2);
        pointer-events: none;
        z-index: 1000;
        transform-origin: top left;
    }
    
    @media (max-width: 768px) {
        .selection-box {
            border-width: 1px;
        }
    }
`;
document.head.appendChild(style);

// Carregar pixels ao iniciar
document.addEventListener('DOMContentLoaded', () => {
    initialize();
    loadPurchasedPixels();
});

// Carregar Stripe
function loadStripe(key) {
    return window.Stripe(key);
}
