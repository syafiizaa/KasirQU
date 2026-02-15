/**
 * Kasir Module - Main POS application logic
 * Handles cart management, UI updates, and transaction processing
 */

const Kasir = {
    // State
    products: [],
    categories: [],
    cart: [],
    holdOrders: [],
    isLoading: false,
    priceType: 'harga_utama', // harga_utama or harga_ecer
    
    // Qty selection state
    selectedProduct: null,
    selectedVarian: null,
    
    // Print state
    lastTransaction: null,

    /**
     * Initialize the kasir application
     */
    async init() {
        console.log('Initializing Kasir POS...');
        
        // Load settings for PrintHelper
        await this.loadSettings();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Load data
        await this.loadCategories();
        await this.loadProducts();
        await this.loadHoldOrders();
        
        // Update cart display
        this.updateCartDisplay();
        
        console.log('Kasir POS ready!');
    },

    /**
     * Load receipt settings
     */
    async loadSettings() {
        try {
            const settings = await API.getSettings();
            
            // Set price type from settings
            this.priceType = settings.price_type || 'harga_utama';
            
            if (typeof PrintHelper !== 'undefined') {
                PrintHelper.setStoreInfo({
                    name: settings.store_name || 'TOKO ANDA',
                    address: settings.store_address || '',
                    phone: settings.store_phone || ''
                });
                PrintHelper.receiptFooter = settings.receipt_footer || 'Terima kasih!';
            }
        } catch (e) {
            console.log('Could not load settings');
        }
    },

    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterProducts(e.target.value);
            });
        }
    },

    /**
     * Format number as Indonesian Rupiah
     */
    formatRupiah(amount) {
        return 'Rp ' + amount.toLocaleString('id-ID');
    },

    /**
     * Load categories
     */
    async loadCategories() {
        try {
            this.categories = await API.getKategori();
            this.renderCategoryFilter();
        } catch (error) {
            console.log('Could not load categories');
        }
    },

    /**
     * Render category filter dropdown
     */
    renderCategoryFilter() {
        const select = document.getElementById('kategori-filter');
        if (!select) return;

        select.innerHTML = '<option value="">Semua Kategori</option>';
        this.categories.forEach(cat => {
            select.innerHTML += `<option value="${cat.id}">${cat.nama}</option>`;
        });
    },

    /**
     * Filter by kategori
     */
    async filterByKategori() {
        const kategoriId = document.getElementById('kategori-filter')?.value;
        await this.loadProducts(kategoriId || null);
    },

    /**
     * Load products from API (with variants)
     */
    async loadProducts(kategoriId = null) {
        this.showLoading(true);
        try {
            // Try to load with variants
            this.products = await API.getBarangWithVarian();
            
            // Filter by kategori if selected
            if (kategoriId) {
                this.products = this.products.filter(p => p.kategori_id == kategoriId);
            }
            
            this.renderProducts(this.products);
        } catch (error) {
            // Fallback to regular load
            try {
                this.products = await API.getBarang(kategoriId);
                this.products.forEach(p => p.varian = []);
                this.renderProducts(this.products);
            } catch (e) {
                this.showError('Gagal memuat data barang: ' + error.message);
            }
        }
        this.showLoading(false);
    },

    /**
     * Get product price based on price type setting
     */
    getProductPrice(product) {
        if (this.priceType === 'harga_ecer' && product.harga_ecer > 0) {
            return product.harga_ecer;
        }
        return product.harga;
    },

    /**
     * Render products grid
     */
    renderProducts(products) {
        const container = document.getElementById('product-grid');
        if (!container) return;

        if (products.length === 0) {
            container.innerHTML = '<div class="cart-empty">Tidak ada barang</div>';
            return;
        }

        container.innerHTML = products.map(product => {
            const hasVarian = product.varian && product.varian.length > 0;
            let priceDisplay, stockDisplay;
            
            if (hasVarian) {
                // Show price range for products with variants
                const prices = product.varian.map(v => this.priceType === 'harga_ecer' && v.harga_ecer > 0 ? v.harga_ecer : v.harga);
                const minPrice = Math.min(...prices);
                const maxPrice = Math.max(...prices);
                priceDisplay = minPrice === maxPrice ? this.formatRupiah(minPrice) : `${this.formatRupiah(minPrice)} - ${this.formatRupiah(maxPrice)}`;
                stockDisplay = `${product.varian.length} varian`;
            } else {
                priceDisplay = this.formatRupiah(this.getProductPrice(product));
                stockDisplay = `Stok: ${product.stok}`;
            }
            
            return `
            <div class="product-item ${hasVarian ? 'has-varian' : ''}" 
                 onclick="Kasir.addToCart(${product.id})"
                 data-id="${product.id}">
                <div class="product-name">${product.nama}</div>
                <div class="product-price">${priceDisplay}</div>
                <div class="product-stock">${stockDisplay}</div>
            </div>
        `;
        }).join('');
    },

    /**
     * Filter products by search term
     */
    filterProducts(searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        if (!term) {
            this.renderProducts(this.products);
            return;
        }

        const filtered = this.products.filter(p => 
            p.nama.toLowerCase().includes(term) || 
            p.kode.toLowerCase().includes(term)
        );
        this.renderProducts(filtered);
    },

    /**
     * Add product to cart
     */
    addToCart(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;

        // Check if product has variants
        if (product.varian && product.varian.length > 0) {
            this.showVarianSelection(product);
            return;
        }

        // No variants - show qty selection
        this.selectedProduct = product;
        this.selectedVarian = null;
        this.showQtySelection();
    },

    /**
     * Show variant selection modal
     */
    showVarianSelection(product) {
        const modal = document.getElementById('modal-varian-select');
        if (!modal) {
            // Fallback: if modal doesn't exist, just add first variant
            if (product.varian.length > 0) {
                this.addProductToCart(product, product.varian[0]);
            }
            return;
        }
        
        document.getElementById('varian-select-title').textContent = `Pilih Varian - ${product.nama}`;
        
        // Build options: only variants (no main product option)
        let optionsHTML = product.varian.map(v => {
            const price = this.priceType === 'harga_ecer' && v.harga_ecer > 0 ? v.harga_ecer : v.harga;
            return `
                <div class="varian-option" onclick="Kasir.selectVarian(${product.id}, ${v.id})">
                    <div class="varian-name">${v.nama_varian}</div>
                    <div class="varian-price">${this.formatRupiah(price)}</div>
                    <div class="varian-stock">Stok: ${v.stok}</div>
                </div>
            `;
        }).join('');
        
        document.getElementById('varian-select-list').innerHTML = optionsHTML;
        modal.style.display = 'flex';
    },

    /**
     * Select main product (without variant) and add to cart
     */
    selectMainProduct(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;
        
        this.addProductToCart(product, null);
        this.hideVarianSelection();
    },

    /**
     * Hide variant selection modal
     */
    hideVarianSelection() {
        const modal = document.getElementById('modal-varian-select');
        if (modal) modal.style.display = 'none';
    },

    /**
     * Select a variant and add to cart
     */
    selectVarian(productId, varianId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;
        
        const varian = product.varian.find(v => v.id === varianId);
        if (!varian) return;
        
        // Store selection and show qty modal
        this.selectedProduct = product;
        this.selectedVarian = varian;
        this.hideVarianSelection();
        this.showQtySelection();
    },

    // ==========================================
    // Qty Selection Modal
    // ==========================================

    /**
     * Show qty selection modal
     */
    showQtySelection() {
        const modal = document.getElementById('modal-qty-select');
        if (!modal) {
            // Fallback: add directly with qty 1
            this.addProductToCart(this.selectedProduct, this.selectedVarian);
            return;
        }

        let itemName, itemPrice;
        
        if (this.selectedVarian) {
            itemName = `${this.selectedProduct.nama} - ${this.selectedVarian.nama_varian}`;
            itemPrice = this.priceType === 'harga_ecer' && this.selectedVarian.harga_ecer > 0 
                ? this.selectedVarian.harga_ecer 
                : this.selectedVarian.harga;
        } else {
            itemName = this.selectedProduct.nama;
            itemPrice = this.getProductPrice(this.selectedProduct);
        }

        document.getElementById('qty-select-name').textContent = itemName;
        document.getElementById('qty-select-price').textContent = this.formatRupiah(itemPrice);
        document.getElementById('qty-select-value').value = 1;
        
        // Reset catatan field
        const catatanInput = document.getElementById('qty-select-catatan');
        if (catatanInput) catatanInput.value = '';
        
        this.updateQtySubtotal();

        modal.style.display = 'flex';
        document.getElementById('qty-select-value').focus();
    },

    /**
     * Hide qty selection modal
     */
    hideQtySelection() {
        const modal = document.getElementById('modal-qty-select');
        if (modal) modal.style.display = 'none';
        this.selectedProduct = null;
        this.selectedVarian = null;
    },

    /**
     * Increase qty in selection modal
     */
    increaseQtySelect() {
        const input = document.getElementById('qty-select-value');
        input.value = parseInt(input.value) + 1;
        this.updateQtySubtotal();
    },

    /**
     * Decrease qty in selection modal
     */
    decreaseQtySelect() {
        const input = document.getElementById('qty-select-value');
        const currentVal = parseInt(input.value);
        if (currentVal > 1) {
            input.value = currentVal - 1;
            this.updateQtySubtotal();
        }
    },

    /**
     * Validate qty input
     */
    validateQtySelect() {
        const input = document.getElementById('qty-select-value');
        let val = parseInt(input.value);
        if (isNaN(val) || val < 1) {
            input.value = 1;
        }
        this.updateQtySubtotal();
    },

    /**
     * Update subtotal display in qty modal
     */
    updateQtySubtotal() {
        let itemPrice;
        
        if (this.selectedVarian) {
            itemPrice = this.priceType === 'harga_ecer' && this.selectedVarian.harga_ecer > 0 
                ? this.selectedVarian.harga_ecer 
                : this.selectedVarian.harga;
        } else if (this.selectedProduct) {
            itemPrice = this.getProductPrice(this.selectedProduct);
        } else {
            return;
        }

        const qty = parseInt(document.getElementById('qty-select-value').value) || 1;
        const subtotal = itemPrice * qty;
        document.getElementById('qty-select-subtotal').textContent = `Subtotal: ${this.formatRupiah(subtotal)}`;
    },

    /**
     * Confirm and add selected product to cart
     */
    confirmAddToCart() {
        if (!this.selectedProduct) return;

        const qty = parseInt(document.getElementById('qty-select-value').value) || 1;
        const catatan = document.getElementById('qty-select-catatan')?.value?.trim() || null;
        this.addProductToCartWithQty(this.selectedProduct, this.selectedVarian, qty, catatan);
        this.hideQtySelection();
    },

    /**
     * Add product (with or without variant) to cart
     */
    addProductToCart(product, varian) {
        this.addProductToCartWithQty(product, varian, 1, null);
    },

    /**
     * Add product to cart with specific qty
     */
    addProductToCartWithQty(product, varian, qty, catatan = null) {
        let itemName, itemPrice, uniqueId;
        
        if (varian) {
            // Add variant
            itemName = `${product.nama} - ${varian.nama_varian}`;
            itemPrice = this.priceType === 'harga_ecer' && varian.harga_ecer > 0 ? varian.harga_ecer : varian.harga;
            uniqueId = `${product.id}_v${varian.id}`;
        } else {
            // Add product without variant
            itemName = product.nama;
            itemPrice = this.getProductPrice(product);
            uniqueId = `${product.id}`;
        }

        // If has catatan, make unique by adding timestamp to prevent merging
        if (catatan) {
            uniqueId = `${uniqueId}_${Date.now()}`;
        }

        // Check if already in cart (using unique identifier) - only merge if no catatan
        const existingItem = !catatan ? this.cart.find(item => item.unique_id === uniqueId) : null;
        
        if (existingItem) {
            existingItem.qty += qty;
            existingItem.subtotal = existingItem.qty * existingItem.harga;
        } else {
            this.cart.push({
                unique_id: uniqueId,
                barang_id: product.id,
                varian_id: varian ? varian.id : null,
                nama_barang: itemName,
                harga: itemPrice,
                qty: qty,
                subtotal: itemPrice * qty,
                catatan: catatan
            });
        }

        this.updateCartDisplay();
    },

    /**
     * Update item quantity in cart
     */
    updateQty(index, delta) {
        const item = this.cart[index];
        if (!item) return;

        const newQty = item.qty + delta;

        if (newQty <= 0) {
            this.removeFromCart(index);
            return;
        }

        item.qty = newQty;
        item.subtotal = item.qty * item.harga;
        this.updateCartDisplay();
    },

    /**
     * Remove item from cart
     */
    removeFromCart(index) {
        this.cart.splice(index, 1);
        this.updateCartDisplay();
    },

    /**
     * Clear entire cart
     */
    clearCart() {
        this.cart = [];
        const namaPelanggan = document.getElementById('nama-pelanggan');
        if (namaPelanggan) namaPelanggan.value = '';
        this.updateCartDisplay();
        this.hideCart();
    },

    /**
     * Calculate cart total
     */
    getTotal() {
        return this.cart.reduce((sum, item) => sum + item.subtotal, 0);
    },

    /**
     * Update cart display
     */
    updateCartDisplay() {
        const container = document.getElementById('cart-items');
        const totalEl = document.getElementById('cart-total');
        const itemCountEl = document.getElementById('item-count');

        if (!container) return;

        if (this.cart.length === 0) {
            container.innerHTML = '<div class="cart-empty">Keranjang kosong</div>';
        } else {
            container.innerHTML = this.cart.map((item, index) => `
                <div class="cart-item">
                    <div class="cart-item-info">
                        <div class="cart-item-name">${item.nama_barang}</div>
                        ${item.catatan ? `<div class="cart-item-catatan">📝 ${item.catatan}</div>` : ''}
                        <div class="cart-item-price">
                            ${this.formatRupiah(item.harga)}
                            <button class="btn-edit-price" onclick="Kasir.showEditPrice(${index})" title="Edit Harga">✏</button>
                        </div>
                    </div>
                    <div class="cart-item-qty">
                        <button class="qty-btn" onclick="Kasir.updateQty(${index}, -1)">−</button>
                        <span class="qty-value">${item.qty}</span>
                        <button class="qty-btn" onclick="Kasir.updateQty(${index}, 1)">+</button>
                    </div>
                    <div class="cart-item-subtotal">${this.formatRupiah(item.subtotal)}</div>
                    <button class="btn-remove" onclick="Kasir.removeFromCart(${index})">×</button>
                </div>
            `).join('');
        }

        const total = this.getTotal();
        if (totalEl) totalEl.textContent = this.formatRupiah(total);
        if (itemCountEl) itemCountEl.textContent = this.cart.length;
        
        // Update floating cart badge
        const cartBadge = document.getElementById('cart-badge');
        const cartBtn = document.getElementById('btn-cart-float');
        if (cartBadge) {
            const totalQty = this.cart.reduce((sum, item) => sum + item.qty, 0);
            cartBadge.textContent = totalQty;
        }
        
        // Update cart button color (green when has items)
        if (cartBtn) {
            if (this.cart.length > 0) {
                cartBtn.classList.add('has-items');
            } else {
                cartBtn.classList.remove('has-items');
            }
        }
    },

    /**
     * Process payment - LUNAS mode
     */
    async processPayment() {
        if (this.cart.length === 0) {
            this.showError('Keranjang kosong!');
            return;
        }

        this.showLoading(true);

        try {
            const namaPelanggan = document.getElementById('nama-pelanggan')?.value || null;
            
            // Prepare transaction data
            const transactionData = {
                items: this.cart.map(item => ({
                    barang_id: item.barang_id || null,
                    nama_barang: item.nama_barang,
                    harga: item.harga,
                    qty: item.qty,
                    subtotal: item.subtotal,
                    catatan: item.catatan || null
                })),
                nama_pelanggan: namaPelanggan
            };

            // Send to API
            const result = await API.createTransaksi(transactionData);
            
            // Store last transaction for printing
            this.lastTransaction = result;

            // Show print method selection dialog
            this.showPrintMethodDialog();

            // Success - clear cart and reload products
            this.showSuccess('Transaksi berhasil!');
            this.clearCart();
            await this.loadProducts();

        } catch (error) {
            this.showError('Gagal memproses transaksi: ' + error.message);
        }

        this.showLoading(false);
    },

    // ==========================================
    // Print Method Selection
    // ==========================================

    /**
     * Show print method selection dialog
     */
    showPrintMethodDialog() {
        const modal = document.getElementById('modal-print-method');
        if (!modal) {
            // Fallback: print directly if modal doesn't exist
            this.printHere();
            return;
        }
        
        // Update dialog info
        if (this.lastTransaction) {
            const infoEl = document.getElementById('print-method-info');
            if (infoEl) {
                infoEl.textContent = `Transaksi #${this.lastTransaction.id} - ${this.formatRupiah(this.lastTransaction.total)}`;
            }
        }
        
        modal.style.display = 'flex';
    },

    /**
     * Hide print method dialog
     */
    hidePrintMethodDialog() {
        const modal = document.getElementById('modal-print-method');
        if (modal) modal.style.display = 'none';
    },

    /**
     * Print receipt here (current browser)
     */
    printHere() {
        this.hidePrintMethodDialog();
        
        if (this.lastTransaction && typeof PrintHelper !== 'undefined') {
            PrintHelper.printReceipt(this.lastTransaction);
        }
    },

    /**
     * Send to Print Station
     */
    async sendToPrintStation() {
        this.hidePrintMethodDialog();
        
        if (!this.lastTransaction) {
            this.showError('Tidak ada transaksi untuk dicetak');
            return;
        }
        
        try {
            await API.addToPrintQueue(this.lastTransaction.id);
            this.showSuccess('Transaksi dikirim ke Print Station!');
        } catch (error) {
            this.showError('Gagal mengirim ke Print Station: ' + error.message);
        }
    },

    /**
     * Skip printing
     */
    skipPrint() {
        this.hidePrintMethodDialog();
        this.lastTransaction = null;
    },

    /**
     * Print item list (without prices) from cart
     */
    async printItemList() {
        if (this.cart.length === 0) {
            this.showError('Keranjang kosong!');
            return;
        }

        try {
            const settings = await API.getSettings();
            const namaPelanggan = document.getElementById('nama-pelanggan')?.value || null;
            
            // Build item list data
            const itemListData = {
                nama_pelanggan: namaPelanggan,
                items: this.cart.map(item => ({
                    nama_barang: item.nama_barang,
                    qty: item.qty,
                    catatan: item.catatan || null
                })),
                created_at: new Date()
            };
            
            // Generate and print item list
            const printHtml = PrintHelper.generateItemListHTML(itemListData, settings);
            const receiptArea = document.getElementById('receipt-area');
            receiptArea.innerHTML = printHtml;
            
            window.print();
            
            this.showSuccess('List barang dicetak!');
        } catch (error) {
            this.showError('Gagal mencetak list: ' + error.message);
        }
    },

    // ==========================================
    // Quick Add Feature
    // ==========================================

    // ==========================================
    // Edit Price Feature
    // ==========================================

    showEditPrice(index) {
        const item = this.cart[index];
        if (!item) return;

        document.getElementById('edit-nama').value = item.nama_barang;
        document.getElementById('edit-harga').value = item.harga;
        document.getElementById('edit-index').value = index;
        document.getElementById('edit-barang-id').value = item.barang_id || '';
        document.getElementById('edit-varian-id').value = item.varian_id || '';
        document.getElementById('edit-update-db').checked = false;
        
        // Disable database option if item has no barang_id and no varian_id
        const updateDbCheckbox = document.getElementById('edit-update-db');
        const updateDbLabel = updateDbCheckbox.parentElement;
        if (!item.barang_id && !item.varian_id) {
            updateDbCheckbox.disabled = true;
            updateDbLabel.style.opacity = '0.5';
            updateDbLabel.title = 'Barang ini tidak tersimpan di database';
        } else {
            updateDbCheckbox.disabled = false;
            updateDbLabel.style.opacity = '1';
            updateDbLabel.title = '';
        }

        document.getElementById('modal-edit-price').style.display = 'flex';
        document.getElementById('edit-harga').focus();
    },

    hideEditPrice() {
        document.getElementById('modal-edit-price').style.display = 'none';
    },

    async saveEditPrice() {
        const index = parseInt(document.getElementById('edit-index').value);
        const newHarga = parseInt(document.getElementById('edit-harga').value) || 0;
        const updateDb = document.getElementById('edit-update-db').checked;
        const barangId = document.getElementById('edit-barang-id').value;
        const varianId = document.getElementById('edit-varian-id').value;

        if (newHarga <= 0) {
            this.showError('Harga harus lebih dari 0!');
            return;
        }

        const item = this.cart[index];
        if (!item) return;

        // Update cart
        item.harga = newHarga;
        item.subtotal = item.qty * newHarga;

        // Update database if checked
        if (updateDb) {
            try {
                if (varianId) {
                    // Item adalah varian - update ke barang_varian
                    const varian = await API.request(`/api/varian/${varianId}`);
                    await API.updateVarian(varianId, {
                        nama_varian: varian.nama_varian,
                        harga: newHarga,
                        harga_ecer: varian.harga_ecer || 0,
                        stok: varian.stok
                    });
                } else if (barangId) {
                    // Item bukan varian - update ke barang
                    const barang = await API.getBarangById(barangId);
                    await API.updateBarang(barangId, {
                        kode: barang.kode,
                        nama: barang.nama,
                        harga: newHarga,
                        harga_ecer: barang.harga_ecer,
                        stok: barang.stok,
                        kategori_id: barang.kategori_id
                    });
                }
                await this.loadProducts(); // Reload products
                this.showSuccess('Harga di keranjang dan database diperbarui!');
            } catch (error) {
                this.showError('Gagal update database: ' + error.message);
            }
        } else {
            this.showSuccess('Harga di keranjang diperbarui!');
        }

        this.updateCartDisplay();
        this.hideEditPrice();
    },

    // ==========================================
    // Cart Modal Functions
    // ==========================================

    showCart() {
        document.getElementById('modal-cart').style.display = 'flex';
    },

    hideCart() {
        document.getElementById('modal-cart').style.display = 'none';
    },

    // ==========================================
    // Quick Add Functions (Manual Input Only)
    // ==========================================

    showQuickAdd() {
        document.getElementById('modal-quick-add').style.display = 'flex';
        
        // Reset fields
        document.getElementById('quick-nama').value = '';
        document.getElementById('quick-varian').value = '';
        document.getElementById('quick-harga').value = '';
        document.getElementById('quick-qty').value = '1';
        document.getElementById('quick-save').checked = false;
        const quickCatatan = document.getElementById('quick-catatan');
        if (quickCatatan) quickCatatan.value = '';
        
        document.getElementById('quick-nama').focus();
    },

    hideQuickAdd() {
        document.getElementById('modal-quick-add').style.display = 'none';
    },

    async addQuickItem() {
        const nama = document.getElementById('quick-nama').value.trim();
        const varian = document.getElementById('quick-varian').value.trim();
        const harga = parseInt(document.getElementById('quick-harga').value) || 0;
        const qty = parseInt(document.getElementById('quick-qty').value) || 1;
        const catatan = document.getElementById('quick-catatan')?.value?.trim() || null;
        const saveToDb = document.getElementById('quick-save').checked;

        if (!nama) {
            this.showError('Nama barang harus diisi!');
            return;
        }

        if (harga <= 0) {
            this.showError('Harga harus lebih dari 0!');
            return;
        }

        let barangId = null;
        let varianId = null;
        
        // Display name with variant if provided
        const displayName = varian ? `${nama} - ${varian}` : nama;

        // Save to database if checked
        if (saveToDb) {
            try {
                const kode = 'QCK' + Date.now().toString().slice(-6);
                
                // Create or find the product
                const result = await API.createBarang({
                    kode: kode,
                    nama: nama,
                    harga: varian ? 0 : harga, // If has variant, main price is 0
                    stok: varian ? 0 : 0,
                    kategori_id: null
                });
                barangId = result.id;
                
                // If variant is provided, create the variant
                if (varian) {
                    const varResult = await API.createVarian({
                        barang_id: barangId,
                        nama_varian: varian,
                        harga: harga,
                        harga_ecer: 0,
                        stok: 0
                    });
                    varianId = varResult.id;
                }
                
                await this.loadProducts(); // Reload products
            } catch (error) {
                this.showError('Gagal menyimpan barang: ' + error.message);
                return;
            }
        }

        // Add to cart
        this.cart.push({
            unique_id: varianId ? `${barangId}_v${varianId}` : `quick_${Date.now()}`,
            barang_id: barangId,
            varian_id: varianId,
            nama_barang: displayName,
            harga: harga,
            qty: qty,
            subtotal: harga * qty,
            catatan: catatan
        });

        this.updateCartDisplay();
        this.hideQuickAdd();
        this.showSuccess('Barang ditambahkan ke keranjang!');
    },

    // ==========================================
    // Hold Order Feature
    // ==========================================

    async loadHoldOrders() {
        try {
            this.holdOrders = await API.getHoldOrders();
            this.updateHoldCount();
        } catch (error) {
            console.log('Could not load hold orders');
        }
    },

    updateHoldCount() {
        const countEl = document.getElementById('hold-count');
        if (countEl) {
            countEl.textContent = this.holdOrders.length;
        }
    },

    async holdOrder() {
        if (this.cart.length === 0) {
            this.showError('Keranjang kosong!');
            return;
        }

        try {
            const namaPelanggan = document.getElementById('nama-pelanggan')?.value || null;
            
            await API.createHoldOrder({
                items: JSON.stringify(this.cart),
                total: this.getTotal(),
                nama_pelanggan: namaPelanggan
            });

            this.showSuccess('Pesanan ditahan!');
            this.clearCart();
            await this.loadHoldOrders();

        } catch (error) {
            this.showError('Gagal menahan pesanan: ' + error.message);
        }
    },

    async showHoldOrders() {
        await this.loadHoldOrders();
        
        const container = document.getElementById('hold-orders-list');
        if (!container) return;

        if (this.holdOrders.length === 0) {
            container.innerHTML = '<div class="cart-empty">Tidak ada pesanan ditahan</div>';
        } else {
            container.innerHTML = this.holdOrders.map(order => `
                <div class="cart-item" style="flex-wrap: wrap;">
                    <div class="cart-item-info">
                        <div class="cart-item-name">${order.nama_pelanggan || 'Tanpa Nama'}</div>
                        <div class="cart-item-price">${this.formatRupiah(order.total)}</div>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-sm btn-primary" onclick="Kasir.restoreHoldOrder(${order.id})">
                            Lanjutkan
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="Kasir.deleteHoldOrder(${order.id})">
                            Hapus
                        </button>
                    </div>
                </div>
            `).join('');
        }

        document.getElementById('modal-hold-orders').style.display = 'flex';
    },

    hideHoldOrders() {
        document.getElementById('modal-hold-orders').style.display = 'none';
    },

    async restoreHoldOrder(orderId) {
        const order = this.holdOrders.find(o => o.id === orderId);
        if (!order) return;

        try {
            this.cart = JSON.parse(order.items);
            const namaPelanggan = document.getElementById('nama-pelanggan');
            if (namaPelanggan && order.nama_pelanggan) {
                namaPelanggan.value = order.nama_pelanggan;
            }
            
            this.updateCartDisplay();
            await API.deleteHoldOrder(orderId);
            await this.loadHoldOrders();
            this.hideHoldOrders();
            this.showSuccess('Pesanan dilanjutkan!');
        } catch (error) {
            this.showError('Gagal melanjutkan pesanan: ' + error.message);
        }
    },

    async deleteHoldOrder(orderId) {
        try {
            await API.deleteHoldOrder(orderId);
            await this.loadHoldOrders();
            this.showHoldOrders();
            this.showSuccess('Pesanan dihapus!');
        } catch (error) {
            this.showError('Gagal menghapus pesanan: ' + error.message);
        }
    },

    // ==========================================
    // UI Helpers
    // ==========================================

    showLoading(show) {
        this.isLoading = show;
        const loader = document.getElementById('loading');
        if (loader) {
            loader.style.display = show ? 'block' : 'none';
        }
    },

    showError(message) {
        const alertContainer = document.getElementById('alert-container');
        if (!alertContainer) {
            alert(message);
            return;
        }

        alertContainer.innerHTML = `
            <div class="alert alert-error">
                ${message}
            </div>
        `;

        setTimeout(() => {
            alertContainer.innerHTML = '';
        }, 3000);
    },

    showSuccess(message) {
        const alertContainer = document.getElementById('alert-container');
        if (!alertContainer) return;

        alertContainer.innerHTML = `
            <div class="alert alert-success">
                ${message}
            </div>
        `;

        setTimeout(() => {
            alertContainer.innerHTML = '';
        }, 3000);
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    Kasir.init();
});
