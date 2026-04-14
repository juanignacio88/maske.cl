// Estado de la Base de Datos y la Bandeja
let productsData = [];
let quoteItems = [];
let currentFilter = 'all';
let currentSubFilter = 'all';
let currentSearch = '';

// Elementos del DOM
const productGrid = document.getElementById('productGrid');
const subCategoryFilters = document.getElementById('subCategoryFilters');
const quoteBadge = document.getElementById('quoteBadge');
const openQuoteBtn = document.getElementById('openQuoteBtn');
const closeQuoteBtn = document.getElementById('closeQuoteBtn');
const quoteOverlay = document.getElementById('quoteOverlay');
const quotePanel = document.getElementById('quotePanel');
const quoteItemsContainer = document.getElementById('quoteItems');
const sendWhatsappBtn = document.getElementById('sendWhatsappBtn');
const sendEmailBtn = document.getElementById('sendEmailBtn');

// Elementos Modal
const productModal = document.getElementById('productModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalIcon = document.getElementById('modalIcon'); // This will be replaced by image or generic icon
const modalCat = document.getElementById('modalCat');
const modalTitle = document.getElementById('modalTitle');
const modalDesc = document.getElementById('modalDesc');
const modalSku = document.getElementById('modalSku');
const modalPack = document.getElementById('modalPack');
const modalAddBtn = document.getElementById('modalAddBtn');

// Configuración de Google Sheets CSV Export (Publicado)
const sheetURL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSnV9sbgGJL06-hCtCSIl1FLhRbDYpi6v9l3Z3K1CuIiVn1S7dDkmfQGbujoDEaiUi3ikqr5b462Gns/pub?output=csv";

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
    initHeaderScroll();
    initFilterButtons();
    initOffcanvas();
    initModalEvents();
    initSearch();

    // Mostrar estado de carga
    productGrid.innerHTML = '<div class="text-center" style="grid-column: 1/-1; padding: 40px;"><p>Cargando catálogo...</p></div>';

    // Fetch datos desde Google Sheets
    await loadProductsFromSheet();
    
    // Debug: mostrar estructura de datos recibidos
    console.log('Productos cargados:', productsData.length);
    if (productsData.length > 0) {
        console.log('Primer producto:', productsData[0]);
        console.log('Keys disponibles:', Object.keys(productsData[0]));
    }
    
    // Render inicial
    renderProducts();
});

// Cargar CSV y parsear a JSON
async function loadProductsFromSheet() {
    try {
        const response = await fetch(sheetURL);
        const csvText = await response.text();
        productsData = parseCSV(csvText);
    } catch (e) {
        console.error("Error cargando productos de Google Sheets:", e);
        productGrid.innerHTML = '<div class="text-center" style="grid-column: 1/-1; color: red;"><p>Error al cargar el catálogo.</p></div>';
    }
}

function parseCSV(text) {
    const lines = text.split('\n');
    const result = [];
    if(lines.length < 2) return [];

    // Header esperado: id, title, category, desc, image, pack
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        // Expresión regular para parsear CSV respetando comillas
        const row = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(item => {
            let val = item.trim();
            if (val.startsWith('"') && val.endsWith('"')) {
                val = val.substring(1, val.length - 1).replace(/""/g, '"');
            }
            return val;
        });

        const product = {};
        headers.forEach((header, index) => {
            product[header] = row[index] || '';
        });

        // Asegurarse de tener un ID de fallback si el sheet no lo tiene
        product.id = product.id || String(i);
        result.push(product);
    }
    return result;
}

// Convierte URLs de Google Drive al formato directo de lh3 (evita bloqueo ORB)
function fixDriveUrl(url) {
    if (!url) return '';
    // Si ya es lh3, no cambiar
    if (url.includes('lh3.googleusercontent.com')) return url;
    // Extraer el ID del archivo de Drive
    const patterns = [
        /drive\.google\.com\/uc\?export=view&id=([^&]+)/,
        /drive\.google\.com\/file\/d\/([^/]+)/,
        /drive\.google\.com\/thumbnail\?.*id=([^&]+)/
    ];
    for (const regex of patterns) {
        const match = url.match(regex);
        if (match) {
            return `https://lh3.googleusercontent.com/d/${match[1]}=s800`;
        }
    }
    return url; // Si no es Drive, devolver tal cual
}

// Renderizar Productos en la Grid
function renderProducts() {
    productGrid.innerHTML = '';
    
    let filtered = currentFilter === 'all' 
        ? productsData 
        : productsData.filter(p => p.category.toLowerCase() === currentFilter.toLowerCase());

    // Aplicar filtro de sub-categoría
    if (currentSubFilter !== 'all') {
        filtered = filtered.filter(p => 
            (p.sub_category || p['sub category'] || '').toLowerCase() === currentSubFilter.toLowerCase()
        );
    }

    // Aplicar búsqueda de texto sobre los resultados filtrados
    if (currentSearch) {
        const terms = currentSearch.toLowerCase().split(/\s+/);
        filtered = filtered.filter(p => {
            const haystack = `${p.title} ${p.desc} ${p.category} ${p.pack}`.toLowerCase();
            return terms.every(term => haystack.includes(term));
        });
    }

    if(filtered.length === 0) {
        productGrid.innerHTML = `
            <div class="search-no-results">
                <i class="ph ph-magnifying-glass"></i>
                <p>No se encontraron productos${currentSearch ? ' para "' + currentSearch + '"' : ' en esta categoría'}.</p>
            </div>`;
        return;
    }

    filtered.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        // Usar placeholder de ícono si no hay imagen en el sheet
        const imgSrc = fixDriveUrl(product.image);
        const imageElement = imgSrc 
            ? `<img src="${imgSrc}" alt="${product.title}" loading="lazy" referrerpolicy="no-referrer" style="width:100%; height:100%; object-fit:contain;">`
            : `<i class="ph ph-package placeholder-img"></i>`;

        card.innerHTML = `
            <div class="product-image" onclick="openProductModal('${product.id}')" style="cursor:pointer; padding: 10px;">
                ${imageElement}
            </div>
            <div class="product-content">
                <span class="product-cat">${getCategoryName(product.category)}</span>
                <h3 class="product-title" onclick="openProductModal('${product.id}')" style="cursor:pointer;">${product.title}</h3>
                <p class="product-desc">${product.desc}</p>
                <div class="product-action">
                    <button class="btn-add" onclick="addToQuote('${product.id}')">
                        <i class="ph ph-plus-circle"></i> Agregar a cotización
                    </button>
                    <button class="btn-outline" onclick="openProductModal('${product.id}')" style="border:none; padding:12px; border-radius:8px;">
                        <i class="ph ph-info"></i>
                    </button>
                </div>
            </div>
        `;
        productGrid.appendChild(card);
    });
}

function getCategoryName(cat) {
    const map = {
        'guantes': 'Guantes',
        'gasas_y_compresas': 'Gasas y Compresas',
        'proteccion': 'Protección',
        'packs_quirurgicos': 'Packs Quirúrgicos',
        'jeringas': 'Jeringas',
        'sondas_y_recolectores': 'Sondas y Recolectores',
        'varios': 'Varios'
    };
    return map[(cat || '').toLowerCase()] || cat;
}

// Filtros de Categorías
function initFilterButtons() {
    const buttons = document.querySelectorAll('#categoryFilters .filter-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            buttons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.getAttribute('data-filter');
            currentSubFilter = 'all'; // Reset sub-filtro al cambiar categoría
            updateSubCategoryFilters();
            renderProducts();
        });
    });
}

// Actualizar filtros de sub-categoría dinámicamente
function updateSubCategoryFilters() {
    if (!subCategoryFilters) {
        console.log('No se encontró el contenedor de sub-filtros');
        return;
    }
    
    if (currentFilter === 'all') {
        subCategoryFilters.style.display = 'none';
        subCategoryFilters.innerHTML = '';
        return;
    }
    
    // Obtener sub-categorías únicas de la categoría seleccionada
    const categoryProducts = productsData.filter(p => p.category.toLowerCase() === currentFilter.toLowerCase());
    console.log(`Productos en categoría ${currentFilter}:`, categoryProducts.length);
    
    const subCats = [...new Set(
        categoryProducts
            .map(p => {
                const sub = p.sub_category || p['sub category'] || p['sub_category'];
                console.log('Producto:', p.title, '- sub_category:', sub);
                return sub;
            })
            .filter(sc => sc && sc.trim())
    )];
    
    console.log('Sub-categorías encontradas:', subCats);
    
    if (subCats.length === 0) {
        subCategoryFilters.style.display = 'none';
        subCategoryFilters.innerHTML = '';
        return;
    }
    
    // Generar botones de sub-categoría
    let html = '<button class="filter-btn sub-filter-btn active" data-sub-filter="all">Todas</button>';
    subCats.forEach(subCat => {
        html += `<button class="filter-btn sub-filter-btn" data-sub-filter="${subCat.toLowerCase()}">${subCat}</button>`;
    });
    
    subCategoryFilters.innerHTML = html;
    subCategoryFilters.style.display = 'flex';
    
    // Agregar event listeners a los nuevos botones
    document.querySelectorAll('.sub-filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.sub-filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentSubFilter = e.target.getAttribute('data-sub-filter');
            renderProducts();
        });
    });
}

// Buscador con debounce
function initSearch() {
    const searchInput = document.getElementById('searchInput');
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            currentSearch = e.target.value.trim();
            renderProducts();
        }, 250);
    });
}

// Lógica de Bandeja de Cotización
function addToQuote(productId) {
    const prod = productsData.find(p => p.id === String(productId));
    if(!prod) return;

    // Verificar si ya existe en la bandeja
    const existing = quoteItems.find(item => item.product.id === String(productId));
    if(existing) {
        existing.qty += 1;
    } else {
        quoteItems.push({ product: prod, qty: 1 });
    }
    
    updateQuoteUI();
    // Opcional: Abrir la bandeja automáticamente o mostrar un toast
    // openQuotePanel(); 
}

function updateQuoteUI() {
    // Update badge number
    const totalItems = quoteItems.reduce((acc, item) => acc + item.qty, 0);
    quoteBadge.innerText = totalItems;

    // Render Items
    if(quoteItems.length === 0) {
        quoteItemsContainer.innerHTML = `
            <div class="empty-quote">
                <i class="ph ph-package"></i>
                <p>Tu bandeja está vacía.<br>Agrega productos del catálogo.</p>
            </div>
        `;
        sendWhatsappBtn.disabled = true;
        sendEmailBtn.disabled = true;
    } else {
        let htmlStr = '';
        quoteItems.forEach((item, index) => {
            htmlStr += `
                <div class="quote-item">
                    <div class="quote-item-img">
                        ${fixDriveUrl(item.product.image) ? `<img src="${fixDriveUrl(item.product.image)}" alt="img" referrerpolicy="no-referrer" style="max-height:100%; object-fit:contain;">` : `<i class="ph ph-package"></i>`}
                    </div>
                    <div class="quote-item-info">
                        <h4>${item.product.title}</h4>
                        <p>Ref: MK-${String(item.product.id).padStart(4, '0')}</p>
                        <div class="quote-controls">
                            <button class="qty-btn" onclick="changeQty(${index}, -1)">-</button>
                            <span>${item.qty}</span>
                            <button class="qty-btn" onclick="changeQty(${index}, 1)">+</button>
                            <button class="remove-btn" onclick="removeItem(${index})"><i class="ph ph-trash"></i> Quitar</button>
                        </div>
                    </div>
                </div>
            `;
        });
        quoteItemsContainer.innerHTML = htmlStr;
        sendWhatsappBtn.disabled = false;
        sendEmailBtn.disabled = false;
    }
}

function changeQty(index, delta) {
    const item = quoteItems[index];
    item.qty += delta;
    if(item.qty <= 0) {
        quoteItems.splice(index, 1);
    }
    updateQuoteUI();
}

function removeItem(index) {
    quoteItems.splice(index, 1);
    updateQuoteUI();
}

// Lógica del Panel Offcanvas
function initOffcanvas() {
    openQuoteBtn.addEventListener('click', openQuotePanel);
    closeQuoteBtn.addEventListener('click', closeQuotePanel);
    quoteOverlay.addEventListener('click', closeQuotePanel);

    sendWhatsappBtn.addEventListener('click', generateWhatsappLink);
    sendEmailBtn.addEventListener('click', generateEmailLink);
}

// Lógica de Modal
function initModalEvents() {
    closeModalBtn.addEventListener('click', closeProductModal);
    productModal.addEventListener('click', (e) => {
        if(e.target === productModal) closeProductModal();
    });
}

function openProductModal(productId) {
    const prod = productsData.find(p => p.id === String(productId));
    if(!prod) return;

    const imgUrl = fixDriveUrl(prod.image);
    if (imgUrl) {
        modalIcon.parentElement.innerHTML = `<img src="${imgUrl}" alt="${prod.title}" referrerpolicy="no-referrer" style="max-width:100%; max-height: 400px; object-fit:contain;">`;
    } else {
        modalIcon.parentElement.innerHTML = `<i class="ph ph-package placeholder-modal" id="modalIcon"></i>`;
    }
    
    modalCat.textContent = getCategoryName(prod.category);
    modalTitle.textContent = prod.title;
    modalDesc.textContent = prod.desc || 'Sin descripción adicional.';
    modalSku.textContent = `MK-${String(prod.id).padStart(4, '0')}`;
    modalPack.textContent = prod.pack || 'Unidad';

    modalAddBtn.onclick = () => {
        addToQuote(prod.id);
        closeProductModal();
        openQuotePanel(); // Optional, show cart after adding from modal
    };

    productModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeProductModal() {
    productModal.classList.remove('active');
    document.body.style.overflow = 'auto';
}

function openQuotePanel() {
    quotePanel.classList.add('open');
    quoteOverlay.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

function closeQuotePanel() {
    quotePanel.classList.remove('open');
    quoteOverlay.classList.remove('active');
    document.body.style.overflow = 'auto';
}

// Header Sticky Effect
function initHeaderScroll() {
    const navbar = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
        if(window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });
}

// Generadores de Enlace
function generateQuoteText() {
    let msg = "Hola Maske. Necesito cotizar los siguientes insumos médicos:\n\n";
    quoteItems.forEach(item => {
        msg += `- ${item.qty}x ${item.product.title} (Ref: MK-${String(item.product.id).padStart(4, '0')})\n`;
    });
    msg += "\nPor favor, confirmarme precios y disponibilidad. ¡Gracias!";
    return msg;
}

function generateWhatsappLink() {
    const text = generateQuoteText();
    // Número base de whatsapp de venta (placeholder)
    const phone = "56912345678"; 
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
}

function generateEmailLink() {
    const text = generateQuoteText();
    const email = "ventas@maske.cl";
    const subject = "Solicitud de Cotización Web";
    const url = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    window.location.href = url;
}
