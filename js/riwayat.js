/**
 * Riwayat Module - Transaction History Management
 */

const Riwayat = {
    transactions: [],
    currentTransaction: null,
    editItems: [],
    updateDbFlags: [], // Track which items should update database
    products: [], // Products list for add item modal
    selectedAddProduct: null,
    selectedAddVarian: null, // For variant selection
    addItemMode: 'select', // 'select' or 'manual'
    priceType: 'harga', // Will be loaded from settings
    lastPrintTransaction: null, // For print method selection

    async init() {
        this.setupYearFilter();
        await this.loadSettings();
        await this.loadProducts();
        await this.loadTransactions();
    },

    async loadProducts() {
        try {
            this.products = await API.getBarangWithVarian();
        } catch (e) {
            console.log('Could not load products');
        }
    },

    formatRupiah(amount) {
        return 'Rp ' + amount.toLocaleString('id-ID');
    },

    formatDateTime(dateStr) {
        const d = new Date(dateStr);
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear();
        const hours = d.getHours().toString().padStart(2, '0');
        const minutes = d.getMinutes().toString().padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}`;
    },

    async loadSettings() {
        try {
            const settings = await API.getSettings();
            this.priceType = settings.price_type || 'harga';
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

    setupYearFilter() {
        const yearSelect = document.getElementById('filter-year');
        if (!yearSelect) return;

        const currentYear = new Date().getFullYear();
        yearSelect.innerHTML = '<option value="">Semua</option>';
        for (let y = currentYear; y >= currentYear - 5; y--) {
            yearSelect.innerHTML += `<option value="${y}">${y}</option>`;
        }
    },

    async loadTransactions(filters = {}) {
        try {
            this.transactions = await API.getTransaksi(filters);
            this.renderTable();
        } catch (error) {
            this.showError('Gagal memuat data: ' + error.message);
        }
    },

    renderTable() {
        const tbody = document.getElementById('tbody-riwayat');
        if (!tbody) return;

        if (this.transactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">Tidak ada transaksi</td></tr>';
            return;
        }

        tbody.innerHTML = this.transactions.map(t => `
            <tr>
                <td>#${t.id}</td>
                <td>${this.formatDateTime(t.created_at)}</td>
                <td>${t.nama_pelanggan || '-'}</td>
                <td>${this.formatRupiah(t.total)}</td>
                <td>
                    <button class="btn btn-sm btn-outline" onclick="Riwayat.viewTransaction(${t.id})">
                        Lihat/Edit
                    </button>
                </td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="Riwayat.deleteTransaction(${t.id})">
                        Hapus
                    </button>
                </td>
            </tr>
        `).join('');
    },

    applyFilter() {
        const filters = {
            start_date: document.getElementById('filter-start-date')?.value || null,
            end_date: document.getElementById('filter-end-date')?.value || null,
            month: document.getElementById('filter-month')?.value || null,
            year: document.getElementById('filter-year')?.value || null,
            nama_pelanggan: document.getElementById('filter-customer')?.value || null
        };

        // Remove null values
        Object.keys(filters).forEach(key => {
            if (!filters[key]) delete filters[key];
        });

        this.loadTransactions(filters);
    },

    resetFilter() {
        document.getElementById('filter-start-date').value = '';
        document.getElementById('filter-end-date').value = '';
        document.getElementById('filter-month').value = '';
        document.getElementById('filter-year').value = '';
        document.getElementById('filter-customer').value = '';
        this.loadTransactions();
    },

    // ==========================================
    // View/Edit Transaction
    // ==========================================

    async viewTransaction(id) {
        try {
            this.currentTransaction = await API.getTransaksiById(id);
            this.editItems = [...this.currentTransaction.items];
            this.updateDbFlags = this.editItems.map(() => false); // Initialize all to false
            
            document.getElementById('modal-transaksi-title').textContent = `Transaksi #${id}`;
            document.getElementById('edit-transaksi-id').value = id;
            document.getElementById('edit-nama-pelanggan').value = this.currentTransaction.nama_pelanggan || '';
            
            this.renderEditItems();
            this.updateEditTotal();
            
            document.getElementById('modal-transaksi').style.display = 'flex';
        } catch (error) {
            this.showError('Gagal memuat transaksi: ' + error.message);
        }
    },

    renderEditItems() {
        const tbody = document.getElementById('tbody-edit-items');
        if (!tbody) return;

        tbody.innerHTML = this.editItems.map((item, index) => {
            const canUpdateDb = item.barang_id != null || item.varian_id != null;
            return `
            <tr data-index="${index}">
                <td>
                    <span>${item.nama_barang}</span>
                </td>
                <td>
                    <input type="text" value="${item.catatan || ''}" 
                           placeholder="Catatan..."
                           onchange="Riwayat.updateItemField(${index}, 'catatan', this.value)"
                           style="width: 100px; font-size: 0.85rem;">
                </td>
                <td>
                    <input type="number" value="${item.harga}" 
                           onchange="Riwayat.updateItemField(${index}, 'harga', parseInt(this.value))"
                           style="width: 80px;">
                </td>
                <td>
                    <input type="number" value="${item.qty}" min="1"
                           onchange="Riwayat.updateItemField(${index}, 'qty', parseInt(this.value))"
                           style="width: 60px;">
                </td>
                <td>${this.formatRupiah(item.subtotal)}</td>
                <td>
                    ${canUpdateDb ? `
                        <input type="checkbox" 
                               ${this.updateDbFlags[index] ? 'checked' : ''}
                               onchange="Riwayat.toggleUpdateDb(${index}, this.checked)"
                               title="Update harga di database">
                    ` : '<span style="color: var(--gray-400);">-</span>'}
                </td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="Riwayat.removeEditItem(${index})">×</button>
                </td>
            </tr>
        `}).join('');
    },

    toggleUpdateDb(index, checked) {
        this.updateDbFlags[index] = checked;
    },

    updateItemField(index, field, value) {
        this.editItems[index][field] = value;
        
        // Recalculate subtotal
        const item = this.editItems[index];
        item.subtotal = item.harga * item.qty;
        
        this.renderEditItems();
        this.updateEditTotal();
    },

    removeEditItem(index) {
        this.editItems.splice(index, 1);
        this.updateDbFlags.splice(index, 1);
        this.renderEditItems();
        this.updateEditTotal();
    },

    addItemRow() {
        // Legacy function - now shows modal instead
        this.showAddItem();
    },

    // ==========================================
    // Add Item Modal Functions
    // ==========================================

    showAddItem() {
        document.getElementById('modal-add-item').style.display = 'flex';
        
        // Reset to select tab
        this.switchAddItemTab('select');
        
        // Reset fields
        document.getElementById('riwayat-add-search').value = '';
        document.getElementById('riwayat-add-select-qty').value = '1';
        document.getElementById('riwayat-add-nama').value = '';
        document.getElementById('riwayat-add-varian').value = '';
        document.getElementById('riwayat-add-harga').value = '';
        document.getElementById('riwayat-add-qty').value = '1';
        document.getElementById('riwayat-add-save').checked = false;
        const addCatatan = document.getElementById('riwayat-add-catatan');
        if (addCatatan) addCatatan.value = '';
        
        this.selectedAddProduct = null;
        this.selectedAddVarian = null;
        this.renderAddProductList(this.products);
        document.getElementById('riwayat-add-search').focus();
    },

    hideAddItem() {
        document.getElementById('modal-add-item').style.display = 'none';
        this.selectedAddProduct = null;
        this.selectedAddVarian = null;
    },

    switchAddItemTab(mode) {
        this.addItemMode = mode;
        
        // Update tab buttons
        document.getElementById('riwayat-tab-select').classList.toggle('active', mode === 'select');
        document.getElementById('riwayat-tab-manual').classList.toggle('active', mode === 'manual');
        
        // Show/hide content
        document.getElementById('riwayat-tab-content-select').style.display = mode === 'select' ? 'block' : 'none';
        document.getElementById('riwayat-tab-content-manual').style.display = mode === 'manual' ? 'block' : 'none';
        
        // Focus appropriate input
        if (mode === 'select') {
            document.getElementById('riwayat-add-search').focus();
        } else {
            document.getElementById('riwayat-add-nama').focus();
        }
    },

    searchAddItem(term) {
        const searchTerm = term.toLowerCase().trim();
        if (!searchTerm) {
            this.renderAddProductList(this.products);
            return;
        }
        
        const filtered = this.products.filter(p => 
            p.nama.toLowerCase().includes(searchTerm) || 
            p.kode.toLowerCase().includes(searchTerm)
        );
        this.renderAddProductList(filtered);
    },

    getProductPrice(product) {
        return this.priceType === 'harga_ecer' && product.harga_ecer > 0 ? product.harga_ecer : product.harga;
    },

    renderAddProductList(products) {
        const container = document.getElementById('riwayat-product-list');
        if (!container) return;

        if (products.length === 0) {
            container.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--gray-500);">Tidak ada barang</div>';
            return;
        }

        container.innerHTML = products.map(p => {
            const hasVarian = p.varian && p.varian.length > 0;
            const priceDisplay = hasVarian 
                ? `<span class="text-muted">Ada ${p.varian.length} varian</span>` 
                : this.formatRupiah(this.getProductPrice(p));
            const selectedClass = this.selectedAddProduct?.id === p.id ? 'selected' : '';
            
            return `
                <div class="quick-product-item ${selectedClass}" 
                     onclick="Riwayat.selectAddProduct(${p.id})">
                    <span class="product-name">${p.nama}</span>
                    <span class="product-price">${priceDisplay}</span>
                </div>
            `;
        }).join('');
    },

    selectAddProduct(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;
        
        // If product has variants, show variant selection modal
        if (product.varian && product.varian.length > 0) {
            this.showVarianSelection(product);
            return;
        }
        
        // No variants, just select the product
        this.selectedAddProduct = product;
        this.selectedAddVarian = null;
        this.renderAddProductList(this.products.filter(p => {
            const searchTerm = document.getElementById('riwayat-add-search').value.toLowerCase().trim();
            if (!searchTerm) return true;
            return p.nama.toLowerCase().includes(searchTerm) || p.kode.toLowerCase().includes(searchTerm);
        }));
    },
    
    // Variant selection for add item
    showVarianSelection(product) {
        const modal = document.getElementById('modal-riwayat-varian');
        if (!modal) return;
        
        document.getElementById('riwayat-varian-title').textContent = `Pilih Varian - ${product.nama}`;
        
        // Build options: only variants (no main product option)
        let optionsHTML = product.varian.map(v => {
            const price = this.priceType === 'harga_ecer' && v.harga_ecer > 0 ? v.harga_ecer : v.harga;
            return `
                <div class="varian-option" onclick="Riwayat.selectVarianOption(${product.id}, ${v.id})">
                    <div class="varian-name">${v.nama_varian}</div>
                    <div class="varian-price">${this.formatRupiah(price)}</div>
                    <div class="varian-stock">Stok: ${v.stok}</div>
                </div>
            `;
        }).join('');
        
        document.getElementById('riwayat-varian-list').innerHTML = optionsHTML;
        modal.style.display = 'flex';
    },
    
    selectVarianOption(productId, varianId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;
        
        this.selectedAddProduct = product;
        
        if (varianId) {
            this.selectedAddVarian = product.varian.find(v => v.id === varianId);
        } else {
            this.selectedAddVarian = null;
        }
        
        this.hideVarianSelection();
        
        // Update the product list to show selection
        this.renderAddProductList(this.products.filter(p => {
            const searchTerm = document.getElementById('riwayat-add-search').value.toLowerCase().trim();
            if (!searchTerm) return true;
            return p.nama.toLowerCase().includes(searchTerm) || p.kode.toLowerCase().includes(searchTerm);
        }));
    },
    
    hideVarianSelection() {
        document.getElementById('modal-riwayat-varian').style.display = 'none';
    },

    async confirmAddItem() {
        if (this.addItemMode === 'select') {
            // Add from selected product
            if (!this.selectedAddProduct) {
                this.showError('Pilih barang terlebih dahulu!');
                return;
            }
            
            const qty = parseInt(document.getElementById('riwayat-add-select-qty').value) || 1;
            const product = this.selectedAddProduct;
            const varian = this.selectedAddVarian;
            
            let itemName, itemPrice, barangId, varianId;
            
            if (varian) {
                itemName = `${product.nama} - ${varian.nama_varian}`;
                itemPrice = this.priceType === 'harga_ecer' && varian.harga_ecer > 0 ? varian.harga_ecer : varian.harga;
                barangId = product.id;
                varianId = varian.id;
            } else {
                itemName = product.nama;
                itemPrice = this.getProductPrice(product);
                barangId = product.id;
                varianId = null;
            }
            
            this.editItems.push({
                barang_id: barangId,
                varian_id: varianId,
                nama_barang: itemName,
                harga: itemPrice,
                qty: qty,
                subtotal: itemPrice * qty
            });
            this.updateDbFlags.push(false);
            
        } else {
            // Manual input
            const nama = document.getElementById('riwayat-add-nama').value.trim();
            const varian = document.getElementById('riwayat-add-varian').value.trim();
            const harga = parseInt(document.getElementById('riwayat-add-harga').value) || 0;
            const qty = parseInt(document.getElementById('riwayat-add-qty').value) || 1;
            const catatan = document.getElementById('riwayat-add-catatan')?.value?.trim() || null;
            const saveToDb = document.getElementById('riwayat-add-save').checked;

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
            const displayName = varian ? `${nama} - ${varian}` : nama;

            // Save to database if checked
            if (saveToDb) {
                try {
                    const kode = 'QCK' + Date.now().toString().slice(-6);
                    const result = await API.createBarang({
                        kode: kode,
                        nama: nama,
                        harga: varian ? 0 : harga, // If has variant, main price is 0
                        stok: 0,
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

            this.editItems.push({
                barang_id: barangId,
                varian_id: varianId,
                nama_barang: displayName,
                harga: harga,
                qty: qty,
                subtotal: harga * qty,
                catatan: catatan
            });
            this.updateDbFlags.push(false);
        }
        
        this.renderEditItems();
        this.updateEditTotal();
        this.hideAddItem();
        this.showSuccess('Barang ditambahkan!');
    },

    updateEditTotal() {
        const total = this.editItems.reduce((sum, item) => sum + item.subtotal, 0);
        document.getElementById('edit-total').textContent = this.formatRupiah(total);
    },

    hideModal() {
        document.getElementById('modal-transaksi').style.display = 'none';
        this.currentTransaction = null;
        this.editItems = [];
        this.updateDbFlags = [];
    },

    async saveEdit() {
        if (this.editItems.length === 0) {
            this.showError('Tidak ada item!');
            return;
        }

        const id = document.getElementById('edit-transaksi-id').value;
        const namaPelanggan = document.getElementById('edit-nama-pelanggan').value || null;

        try {
            // First, update database prices for flagged items
            for (let i = 0; i < this.editItems.length; i++) {
                const item = this.editItems[i];
                if (this.updateDbFlags[i]) {
                    try {
                        if (item.varian_id) {
                            // Item adalah varian - update ke barang_varian
                            const varian = await API.request(`/api/varian/${item.varian_id}`);
                            await API.updateVarian(item.varian_id, {
                                nama_varian: varian.nama_varian,
                                harga: item.harga,
                                harga_ecer: varian.harga_ecer || 0,
                                stok: varian.stok
                            });
                        } else if (item.barang_id) {
                            // Item bukan varian - update ke barang
                            const barang = await API.getBarangById(item.barang_id);
                            await API.updateBarang(item.barang_id, {
                                kode: barang.kode,
                                nama: barang.nama,
                                harga: item.harga,
                                harga_ecer: barang.harga_ecer,
                                stok: barang.stok,
                                kategori_id: barang.kategori_id
                            });
                        }
                    } catch (e) {
                        console.log('Could not update barang/varian:', e.message);
                    }
                }
            }

            // Then update the transaction
            const result = await API.updateTransaksi(id, {
                items: this.editItems.map(item => ({
                    barang_id: item.barang_id || null,
                    nama_barang: item.nama_barang,
                    harga: item.harga,
                    qty: item.qty,
                    subtotal: item.subtotal,
                    catatan: item.catatan || null
                })),
                nama_pelanggan: namaPelanggan
            });

            // Store for print method selection
            this.lastPrintTransaction = result;
            
            // Show print method selection
            this.showPrintMethodDialog();

            this.showSuccess('Transaksi berhasil diupdate!');
            this.hideModal();
            await this.loadTransactions();
        } catch (error) {
            this.showError('Gagal menyimpan: ' + error.message);
        }
    },

    async printReceipt() {
        if (!this.currentTransaction) return;

        // Update current transaction with edited items
        const updatedTransaction = {
            ...this.currentTransaction,
            items: this.editItems,
            total: this.editItems.reduce((sum, item) => sum + item.subtotal, 0),
            nama_pelanggan: document.getElementById('edit-nama-pelanggan').value || null
        };

        // Store for print method selection
        this.lastPrintTransaction = updatedTransaction;
        
        // Show print method selection
        this.showPrintMethodDialog();
    },

    /**
     * Show print list method selection modal
     */
    showItemListPrintMethod() {
        if (this.editItems.length === 0) {
            this.showError('Tidak ada item!');
            return;
        }
        const modal = document.getElementById('modal-print-list-method');
        if (modal) {
            modal.style.display = 'flex';
        } else {
            // Fallback: print directly
            this.printItemListHere();
        }
    },

    /**
     * Hide print list method modal
     */
    hideItemListPrintMethod() {
        const modal = document.getElementById('modal-print-list-method');
        if (modal) modal.style.display = 'none';
    },

    /**
     * Print item list here (current browser)
     */
    async printItemListHere() {
        this.hideItemListPrintMethod();
        
        if (this.editItems.length === 0) {
            this.showError('Tidak ada item!');
            return;
        }

        try {
            const settings = await API.getSettings();
            const namaPelanggan = document.getElementById('edit-nama-pelanggan')?.value || null;
            
            // Build item list data
            const itemListData = {
                nama_pelanggan: namaPelanggan,
                items: this.editItems.map(item => ({
                    nama_barang: item.nama_barang,
                    qty: item.qty,
                    catatan: item.catatan || null
                })),
                created_at: this.currentTransaction?.created_at || new Date()
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

    /**
     * Send item list to Print Station
     */
    async sendItemListToPrintStation() {
        this.hideItemListPrintMethod();
        
        if (this.editItems.length === 0) {
            this.showError('Tidak ada item!');
            return;
        }
        
        try {
            const namaPelanggan = document.getElementById('edit-nama-pelanggan')?.value || null;
            
            // Build item list data
            const itemListData = {
                nama_pelanggan: namaPelanggan,
                items: this.editItems.map(item => ({
                    nama_barang: item.nama_barang,
                    qty: item.qty,
                    catatan: item.catatan || null
                })),
                created_at: this.currentTransaction?.created_at || new Date().toISOString(),
                total_items: this.editItems.reduce((sum, item) => sum + item.qty, 0)
            };
            
            console.log('Sending item list to print queue:', itemListData);
            
            // Send to print queue as item list type
            const result = await API.addItemListToPrintQueue(itemListData);
            console.log('Print queue result:', result);
            this.showSuccess('List barang dikirim ke Print Station!');
        } catch (error) {
            console.error('Error sending to print queue:', error);
            this.showError('Gagal mengirim ke Print Station: ' + error.message);
        }
    },

    // ==========================================
    // Print Method Selection
    // ==========================================

    showPrintMethodDialog() {
        const modal = document.getElementById('modal-print-method');
        if (!modal) {
            // Fallback: print directly if modal doesn't exist
            this.printHere();
            return;
        }
        
        // Update dialog info
        if (this.lastPrintTransaction) {
            const infoEl = document.getElementById('print-method-info');
            if (infoEl) {
                infoEl.textContent = `Transaksi #${this.lastPrintTransaction.id} - ${this.formatRupiah(this.lastPrintTransaction.total)}`;
            }
        }
        
        modal.style.display = 'flex';
    },

    hidePrintMethodDialog() {
        const modal = document.getElementById('modal-print-method');
        if (modal) modal.style.display = 'none';
    },

    printHere() {
        this.hidePrintMethodDialog();
        
        if (this.lastPrintTransaction && typeof PrintHelper !== 'undefined') {
            PrintHelper.printReceipt(this.lastPrintTransaction);
        }
    },

    async sendToPrintStation() {
        this.hidePrintMethodDialog();
        
        if (!this.lastPrintTransaction) {
            this.showError('Tidak ada transaksi untuk dicetak');
            return;
        }
        
        try {
            await API.addToPrintQueue(this.lastPrintTransaction.id);
            this.showSuccess('Transaksi dikirim ke Print Station!');
        } catch (error) {
            this.showError('Gagal mengirim ke Print Station: ' + error.message);
        }
    },

    skipPrint() {
        this.hidePrintMethodDialog();
        this.lastPrintTransaction = null;
    },

    // ==========================================
    // Share to WhatsApp
    // ==========================================

    /**
     * Share receipt to WhatsApp as JPG image
     */
    async shareToWhatsApp() {
        if (!this.currentTransaction) {
            this.showError('Tidak ada transaksi untuk dibagikan');
            return;
        }

        // Update transaction data with edited items
        const transactionData = {
            ...this.currentTransaction,
            items: this.editItems,
            total: this.editItems.reduce((sum, item) => sum + item.subtotal, 0),
            nama_pelanggan: document.getElementById('edit-nama-pelanggan')?.value || null
        };

        try {
            this.showSuccess('Membuat gambar nota...');

            // Create a temporary container for the receipt
            const tempContainer = document.createElement('div');
            tempContainer.style.cssText = 'position: fixed; top: 0; left: 0; background: white; padding: 10px; z-index: 9999;';
            tempContainer.innerHTML = PrintHelper.generateReceiptHTML(transactionData);
            document.body.appendChild(tempContainer);

            // Wait for content to render
            await new Promise(resolve => setTimeout(resolve, 300));

            // Get the receipt div inside container
            const receiptDiv = tempContainer.querySelector('div');
            if (!receiptDiv) {
                throw new Error('Receipt content not found');
            }

            // Capture full receipt as single high-resolution image (scale 4 for ~1080p quality)
            const canvas = await html2canvas(receiptDiv, {
                scale: 4,
                backgroundColor: '#ffffff',
                logging: false,
                useCORS: true,
                width: receiptDiv.offsetWidth,
                height: receiptDiv.offsetHeight
            });

            // Remove temporary container
            document.body.removeChild(tempContainer);

            // Download image
            const link = document.createElement('a');
            link.download = `nota_${transactionData.id}.jpg`;
            link.href = canvas.toDataURL('image/jpeg', 0.95);
            link.click();

            this.showSuccess('Nota berhasil diunduh! Silakan bagikan melalui WhatsApp.');

        } catch (error) {
            console.error('Share error:', error);
            this.showError('Gagal membuat gambar nota: ' + error.message);
        }
    },

    // ==========================================
    // UI Helpers
    // ==========================================

    showError(message) {
        const alertContainer = document.getElementById('alert-container');
        if (!alertContainer) {
            alert(message);
            return;
        }

        alertContainer.innerHTML = `<div class="alert alert-error">${message}</div>`;
        setTimeout(() => { alertContainer.innerHTML = ''; }, 3000);
    },

    showSuccess(message) {
        const alertContainer = document.getElementById('alert-container');
        if (!alertContainer) return;

        alertContainer.innerHTML = `<div class="alert alert-success">${message}</div>`;
        setTimeout(() => { alertContainer.innerHTML = ''; }, 3000);
    },

    // ==========================================
    // Delete Transaction
    // ==========================================

    async deleteTransaction(id) {
        const confirmed = confirm(
            `Apakah Anda yakin ingin menghapus transaksi #${id}?\n\n` +
            `Stok barang akan dikembalikan secara otomatis.`
        );
        
        if (!confirmed) return;

        try {
            await API.deleteTransaksi(id);
            this.showSuccess(`Transaksi #${id} berhasil dihapus!`);
            await this.loadTransactions();
        } catch (error) {
            this.showError('Gagal menghapus transaksi: ' + error.message);
        }
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    Riwayat.init();
});
