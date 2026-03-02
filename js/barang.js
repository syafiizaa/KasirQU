/**
 * Barang Module - Product & Category Management
 */

const Barang = {
    products: [],
    categories: [],
    currentTab: 'barang',

    async init() {
        await this.loadKategori();
        await this.loadBarang();
    },

    formatRupiah(amount) {
        return 'Rp ' + amount.toLocaleString('id-ID');
    },

    // ==========================================
    // Tab Management
    // ==========================================

    showTab(tab) {
        this.currentTab = tab;
        
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.style.display = 'none';
        });

        if (tab === 'barang') {
            document.querySelector('.tab-btn:nth-child(1)').classList.add('active');
            document.getElementById('tab-barang').style.display = 'block';
        } else {
            document.querySelector('.tab-btn:nth-child(2)').classList.add('active');
            document.getElementById('tab-kategori').style.display = 'block';
        }
    },

    // ==========================================
    // Kategori Management
    // ==========================================

    async loadKategori() {
        try {
            this.categories = await API.getKategori();
            this.renderKategoriTable();
            this.renderKategoriDropdowns();
        } catch (error) {
            this.showError('Gagal memuat kategori: ' + error.message);
        }
    },

    renderKategoriTable() {
        const tbody = document.getElementById('tbody-kategori');
        if (!tbody) return;

        if (this.categories.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center">Tidak ada kategori</td></tr>';
            return;
        }

        tbody.innerHTML = this.categories.map(cat => `
            <tr>
                <td>${cat.id}</td>
                <td>${cat.nama}</td>
                <td>
                    <button class="btn btn-sm btn-outline" onclick="Barang.editKategori(${cat.id})">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="Barang.hapusKategori(${cat.id})">Hapus</button>
                </td>
            </tr>
        `).join('');
    },

    renderKategoriDropdowns() {
        // Category chips for filter
        const chipsContainer = document.getElementById('category-chips');
        if (chipsContainer) {
            let chipsHtml = '<button class="category-chip active" data-id="" onclick="Barang.filterByKategori(\'\')">Semua</button>';
            this.categories.forEach(cat => {
                chipsHtml += `<button class="category-chip" data-id="${cat.id}" onclick="Barang.filterByKategori('${cat.id}')">${cat.nama}</button>`;
            });
            chipsContainer.innerHTML = chipsHtml;
        }

        // Form dropdown (keep as select for modal)
        const formSelect = document.getElementById('barang-kategori');
        if (formSelect) {
            formSelect.innerHTML = '<option value="">Pilih Kategori</option>';
            this.categories.forEach(cat => {
                formSelect.innerHTML += `<option value="${cat.id}">${cat.nama}</option>`;
            });
        }
    },

    selectedKategori: '',

    filterByKategori(kategoriId) {
        this.selectedKategori = kategoriId;
        
        // Update active chip
        document.querySelectorAll('.category-chip').forEach(chip => {
            chip.classList.remove('active');
            if (chip.dataset.id === kategoriId) {
                chip.classList.add('active');
            }
        });
        
        this.loadBarang();
    },

    showAddKategori() {
        document.getElementById('modal-kategori-title').textContent = 'Tambah Kategori';
        document.getElementById('kategori-id').value = '';
        document.getElementById('kategori-nama').value = '';
        document.getElementById('modal-kategori').style.display = 'flex';
    },

    editKategori(id) {
        const kategori = this.categories.find(k => k.id === id);
        if (!kategori) return;

        document.getElementById('modal-kategori-title').textContent = 'Edit Kategori';
        document.getElementById('kategori-id').value = kategori.id;
        document.getElementById('kategori-nama').value = kategori.nama;
        document.getElementById('modal-kategori').style.display = 'flex';
    },

    hideKategoriForm() {
        document.getElementById('modal-kategori').style.display = 'none';
    },

    async saveKategori() {
        const id = document.getElementById('kategori-id').value;
        const nama = document.getElementById('kategori-nama').value.trim();

        if (!nama) {
            this.showError('Nama kategori harus diisi!');
            return;
        }

        try {
            if (id) {
                await API.updateKategori(id, { nama });
                this.showSuccess('Kategori berhasil diupdate!');
            } else {
                await API.createKategori({ nama });
                this.showSuccess('Kategori berhasil ditambahkan!');
            }
            this.hideKategoriForm();
            await this.loadKategori();
        } catch (error) {
            this.showError('Gagal menyimpan kategori: ' + error.message);
        }
    },

    async hapusKategori(id) {
        if (!confirm('Yakin ingin menghapus kategori ini?')) return;

        try {
            await API.deleteKategori(id);
            this.showSuccess('Kategori berhasil dihapus!');
            await this.loadKategori();
        } catch (error) {
            this.showError('Gagal menghapus kategori: ' + error.message);
        }
    },

    // ==========================================
    // Barang Management
    // ==========================================

    async loadBarang() {
        const kategoriId = this.selectedKategori || null;
        
        try {
            // Load products with variants
            this.products = await API.getBarangWithVarian();
            
            // Filter by kategori if selected
            if (kategoriId) {
                this.products = this.products.filter(b => b.kategori_id == kategoriId);
            }
            
            this.renderBarangTable();
        } catch (error) {
            // Fallback to regular load if endpoint not available
            try {
                this.products = await API.getBarang(kategoriId);
                this.products.forEach(p => p.varian = []);
                this.renderBarangTable();
            } catch (e) {
                this.showError('Gagal memuat barang: ' + error.message);
            }
        }
    },

    // Track which products have expanded variants
    expandedVariants: new Set(),

    toggleVariants(barangId) {
        if (this.expandedVariants.has(barangId)) {
            this.expandedVariants.delete(barangId);
        } else {
            this.expandedVariants.add(barangId);
        }
        
        // Check if there's an active search filter
        const searchInput = document.getElementById('search-barang');
        if (searchInput && searchInput.value.trim()) {
            this.filterBarang(); // Use filter to maintain search results
        } else {
            this.renderBarangTable(); // No filter, render all
        }
    },

    renderBarangTable() {
        const tbody = document.getElementById('tbody-barang');
        if (!tbody) return;

        // Update count badge
        const countBadge = document.getElementById('barang-count');
        if (countBadge) {
            countBadge.textContent = `(${this.products.length} item)`;
        }

        if (this.products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">Tidak ada barang</td></tr>';
            return;
        }

        let html = '';
        this.products.forEach(b => {
            const varianCount = b.varian ? b.varian.length : 0;
            const hasVarian = varianCount > 0;
            const isExpanded = this.expandedVariants.has(b.id);
            const toggleIcon = isExpanded ? '▼' : '▶';
            
            // Main product row
            html += `
                <tr class="product-row ${hasVarian ? 'has-varian' : ''}">
                    <td>${b.kode}</td>
                    <td><strong>${b.nama}</strong></td>
                    <td>${b.kategori_nama || '-'}</td>
                    <td>
                        ${hasVarian ? `
                            <span class="varian-toggle" onclick="Barang.toggleVariants(${b.id})" style="cursor:pointer;">
                                ${toggleIcon} <span class="badge badge-info">${varianCount} varian</span>
                            </span>
                        ` : '<span class="text-muted">-</span>'}
                        <button class="btn btn-sm btn-outline" onclick="Barang.showVarianModal(${b.id})">Kelola</button>
                    </td>
                    <td>${hasVarian ? '-' : this.formatRupiah(b.harga)}</td>
                    <td>${hasVarian ? '-' : this.formatRupiah(b.harga_ecer || 0)}</td>
                    <td>${b.stok}</td>
                    <td>
                        <button class="btn btn-sm btn-outline" onclick="Barang.editBarang(${b.id})">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="Barang.hapusBarang(${b.id})">Hapus</button>
                    </td>
                </tr>
            `;
            
            // Variant rows (only if expanded)
            if (hasVarian && isExpanded) {
                b.varian.forEach(v => {
                    html += `
                        <tr class="varian-row">
                            <td></td>
                            <td style="padding-left:2rem;">↳ ${v.nama_varian}</td>
                            <td></td>
                            <td></td>
                            <td>${this.formatRupiah(v.harga)}</td>
                            <td>${this.formatRupiah(v.harga_ecer || 0)}</td>
                            <td>${v.stok}</td>
                            <td></td>
                        </tr>
                    `;
                });
            }
        });
        
        tbody.innerHTML = html;
    },

    filterBarang() {
        const search = document.getElementById('search-barang')?.value.toLowerCase() || '';
        
        const filtered = this.products.filter(b => 
            b.nama.toLowerCase().includes(search) ||
            b.kode.toLowerCase().includes(search)
        );

        const tbody = document.getElementById('tbody-barang');
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">Tidak ditemukan</td></tr>';
            return;
        }

        let html = '';
        filtered.forEach(b => {
            const varianCount = b.varian ? b.varian.length : 0;
            const hasVarian = varianCount > 0;
            const isExpanded = this.expandedVariants.has(b.id);
            const toggleIcon = isExpanded ? '▼' : '▶';
            
            html += `
                <tr class="product-row ${hasVarian ? 'has-varian' : ''}">
                    <td>${b.kode}</td>
                    <td><strong>${b.nama}</strong></td>
                    <td>${b.kategori_nama || '-'}</td>
                    <td>
                        ${hasVarian ? `
                            <span class="varian-toggle" onclick="Barang.toggleVariants(${b.id})" style="cursor:pointer;">
                                ${toggleIcon} <span class="badge badge-info">${varianCount} varian</span>
                            </span>
                        ` : '<span class="text-muted">-</span>'}
                        <button class="btn btn-sm btn-outline" onclick="Barang.showVarianModal(${b.id})">Kelola</button>
                    </td>
                    <td>${hasVarian ? '-' : this.formatRupiah(b.harga)}</td>
                    <td>${hasVarian ? '-' : this.formatRupiah(b.harga_ecer || 0)}</td>
                    <td>${b.stok}</td>
                    <td>
                        <button class="btn btn-sm btn-outline" onclick="Barang.editBarang(${b.id})">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="Barang.hapusBarang(${b.id})">Hapus</button>
                    </td>
                </tr>
            `;
            
            if (hasVarian && isExpanded) {
                b.varian.forEach(v => {
                    html += `
                        <tr class="varian-row">
                            <td></td>
                            <td style="padding-left:2rem;">↳ ${v.nama_varian}</td>
                            <td></td>
                            <td></td>
                            <td>${this.formatRupiah(v.harga)}</td>
                            <td>${this.formatRupiah(v.harga_ecer || 0)}</td>
                            <td>${v.stok}</td>
                            <td></td>
                        </tr>
                    `;
                });
            }
        });
        
        tbody.innerHTML = html;
    },

    showAddForm() {
        document.getElementById('modal-barang-title').textContent = 'Tambah Barang';
        document.getElementById('barang-id').value = '';
        document.getElementById('barang-kode').value = '';
        document.getElementById('barang-nama').value = '';
        document.getElementById('barang-kategori').value = '';
        document.getElementById('barang-harga').value = '';
        document.getElementById('barang-harga-ecer').value = '0';
        document.getElementById('barang-stok').value = '0';
        
        // Reset disabled state for harga inputs
        const hargaInput = document.getElementById('barang-harga');
        const hargaEcerInput = document.getElementById('barang-harga-ecer');
        hargaInput.disabled = false;
        hargaEcerInput.disabled = false;
        hargaInput.placeholder = '';
        hargaEcerInput.placeholder = '0';
        
        // Show variant section for new products
        document.getElementById('varian-section-add').style.display = 'block';
        document.getElementById('varian-list-add').innerHTML = '';
        this.varianInputCount = 0;
        
        document.getElementById('modal-barang').style.display = 'flex';
    },

    editBarang(id) {
        const barang = this.products.find(b => b.id === id);
        if (!barang) return;

        const hasVarian = barang.varian && barang.varian.length > 0;

        document.getElementById('modal-barang-title').textContent = 'Edit Barang';
        document.getElementById('barang-id').value = barang.id;
        document.getElementById('barang-kode').value = barang.kode;
        document.getElementById('barang-nama').value = barang.nama;
        document.getElementById('barang-kategori').value = barang.kategori_id || '';
        document.getElementById('barang-harga').value = hasVarian ? '' : barang.harga;
        document.getElementById('barang-harga-ecer').value = hasVarian ? '' : (barang.harga_ecer || 0);
        document.getElementById('barang-stok').value = barang.stok;
        
        // Disable harga inputs if product has variants
        const hargaInput = document.getElementById('barang-harga');
        const hargaEcerInput = document.getElementById('barang-harga-ecer');
        hargaInput.disabled = hasVarian;
        hargaEcerInput.disabled = hasVarian;
        
        if (hasVarian) {
            hargaInput.placeholder = 'Harga ada di varian';
            hargaEcerInput.placeholder = 'Harga ada di varian';
        } else {
            hargaInput.placeholder = '';
            hargaEcerInput.placeholder = '0';
        }
        
        // Hide variant section when editing (use Kelola Varian instead)
        document.getElementById('varian-section-add').style.display = 'none';
        
        document.getElementById('modal-barang').style.display = 'flex';
    },

    hideBarangForm() {
        document.getElementById('modal-barang').style.display = 'none';
        document.getElementById('varian-list-add').innerHTML = '';
        this.varianInputCount = 0;
    },
    
    // Variant input management for new products
    varianInputCount: 0,
    
    addVarianInput() {
        this.varianInputCount++;
        const idx = this.varianInputCount;
        const container = document.getElementById('varian-list-add');
        
        const html = `
            <div id="varian-input-${idx}" class="varian-input-row">
                <div class="form-row">
                    <div class="input-group">
                        <label>Nama Varian</label>
                        <input type="text" id="add-varian-nama-${idx}" placeholder="Contoh: 60ml">
                    </div>
                    <div class="input-group">
                        <label>Harga</label>
                        <input type="number" id="add-varian-harga-${idx}" placeholder="Harga" min="0">
                    </div>
                    <div class="input-group">
                        <label>Harga Ecer</label>
                        <input type="number" id="add-varian-harga-ecer-${idx}" placeholder="0" min="0" value="0">
                    </div>
                    <div class="input-group">
                        <label>Stok</label>
                        <input type="number" id="add-varian-stok-${idx}" placeholder="0" min="0" value="0">
                    </div>
                    <div class="input-group">
                        <label>&nbsp;</label>
                        <button type="button" class="btn btn-danger btn-sm" onclick="Barang.removeVarianInput(${idx})">×</button>
                    </div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    },
    
    removeVarianInput(idx) {
        const el = document.getElementById(`varian-input-${idx}`);
        if (el) el.remove();
    },
    
    getVarianInputs() {
        const variants = [];
        const container = document.getElementById('varian-list-add');
        const rows = container.querySelectorAll('.varian-input-row');
        
        rows.forEach(row => {
            const idx = row.id.replace('varian-input-', '');
            const nama = document.getElementById(`add-varian-nama-${idx}`)?.value.trim();
            const harga = parseInt(document.getElementById(`add-varian-harga-${idx}`)?.value) || 0;
            const hargaEcer = parseInt(document.getElementById(`add-varian-harga-ecer-${idx}`)?.value) || 0;
            const stok = parseInt(document.getElementById(`add-varian-stok-${idx}`)?.value) || 0;
            
            if (nama && harga > 0) {
                variants.push({ nama_varian: nama, harga, harga_ecer: hargaEcer, stok });
            }
        });
        
        return variants;
    },

    async saveBarang() {
        const id = document.getElementById('barang-id').value;
        
        // Get variants (only for new products)
        const variants = id ? [] : this.getVarianInputs();
        const hasVariants = variants.length > 0;
        
        const data = {
            kode: document.getElementById('barang-kode').value.trim(),
            nama: document.getElementById('barang-nama').value.trim(),
            kategori_id: document.getElementById('barang-kategori').value || null,
            // If product has variants, harga should be null
            harga: hasVariants ? null : (document.getElementById('barang-harga').value ? parseInt(document.getElementById('barang-harga').value) : null),
            harga_ecer: hasVariants ? null : (document.getElementById('barang-harga-ecer').value ? parseInt(document.getElementById('barang-harga-ecer').value) : null),
            stok: parseInt(document.getElementById('barang-stok').value) || 0
        };

        if (!data.kode || !data.nama) {
            this.showError('Kode dan Nama harus diisi!');
            return;
        }
        
        // Validate: if no variants, main price must be > 0
        if (!hasVariants && (!data.harga || data.harga <= 0)) {
            this.showError('Harga harus lebih dari 0!');
            return;
        }

        try {
            if (id) {
                // When editing, check if product has existing variants
                const existingBarang = this.products.find(b => b.id == id);
                const hasExistingVariants = existingBarang && existingBarang.varian && existingBarang.varian.length > 0;
                
                if (hasExistingVariants) {
                    // Product has variants, set harga to null
                    data.harga = null;
                    data.harga_ecer = null;
                }
                
                await API.updateBarang(id, data);
                this.showSuccess('Barang berhasil diupdate!');
            } else {
                // Create product first
                const result = await API.createBarang(data);
                const newBarangId = result.id;
                
                // Create variants if any
                for (const v of variants) {
                    await API.createVarian({
                        barang_id: newBarangId,
                        nama_varian: v.nama_varian,
                        harga: v.harga,
                        harga_ecer: v.harga_ecer,
                        stok: v.stok
                    });
                }
                
                const varMsg = hasVariants ? ` dengan ${variants.length} varian` : '';
                this.showSuccess(`Barang berhasil ditambahkan${varMsg}!`);
            }
            this.hideBarangForm();
            await this.loadBarang();
        } catch (error) {
            this.showError('Gagal menyimpan barang: ' + error.message);
        }
    },

    async hapusBarang(id) {
        if (!confirm('Yakin ingin menghapus barang ini?')) return;

        try {
            await API.deleteBarang(id);
            this.showSuccess('Barang berhasil dihapus!');
            await this.loadBarang();
        } catch (error) {
            this.showError('Gagal menghapus barang: ' + error.message);
        }
    },

    // ==========================================
    // Varian Management
    // ==========================================

    currentVarianBarangId: null,

    showVarianModal(barangId) {
        const barang = this.products.find(b => b.id === barangId);
        if (!barang) return;

        this.currentVarianBarangId = barangId;
        document.getElementById('varian-barang-id').value = barangId;
        document.getElementById('varian-barang-nama').textContent = barang.nama;
        
        // Clear form
        document.getElementById('new-varian-nama').value = '';
        document.getElementById('new-varian-harga').value = '';
        document.getElementById('new-varian-harga-ecer').value = '0';
        document.getElementById('new-varian-stok').value = '0';
        
        this.renderVarianTable(barang.varian || []);
        document.getElementById('modal-varian').style.display = 'flex';
    },

    hideVarianModal() {
        document.getElementById('modal-varian').style.display = 'none';
        this.currentVarianBarangId = null;
    },

    renderVarianTable(varianList) {
        const tbody = document.getElementById('tbody-varian');
        if (!tbody) return;

        if (varianList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">Belum ada varian. Tambahkan varian di atas.</td></tr>';
            return;
        }

        tbody.innerHTML = varianList.map(v => `
            <tr>
                <td>${v.nama_varian}</td>
                <td>${this.formatRupiah(v.harga)}</td>
                <td>${this.formatRupiah(v.harga_ecer || 0)}</td>
                <td>${v.stok}</td>
                <td>
                    <button class="btn btn-sm btn-outline" onclick="Barang.editVarian(${v.id})">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="Barang.hapusVarian(${v.id})">Hapus</button>
                </td>
            </tr>
        `).join('');
    },

    async addVarian() {
        const barangId = this.currentVarianBarangId;
        if (!barangId) return;

        const namaVarian = document.getElementById('new-varian-nama').value.trim();
        const harga = parseInt(document.getElementById('new-varian-harga').value) || 0;
        const hargaEcer = parseInt(document.getElementById('new-varian-harga-ecer').value) || 0;
        const stok = parseInt(document.getElementById('new-varian-stok').value) || 0;

        if (!namaVarian) {
            this.showError('Nama varian harus diisi!');
            return;
        }

        if (harga <= 0) {
            this.showError('Harga harus lebih dari 0!');
            return;
        }

        try {
            await API.createVarian({
                barang_id: barangId,
                nama_varian: namaVarian,
                harga: harga,
                harga_ecer: hargaEcer,
                stok: stok
            });
            
            this.showSuccess('Varian berhasil ditambahkan!');
            
            // Clear form
            document.getElementById('new-varian-nama').value = '';
            document.getElementById('new-varian-harga').value = '';
            document.getElementById('new-varian-harga-ecer').value = '0';
            document.getElementById('new-varian-stok').value = '0';
            
            // Reload data
            await this.loadBarang();
            
            // Re-render varian table
            const barang = this.products.find(b => b.id === barangId);
            if (barang) {
                this.renderVarianTable(barang.varian || []);
            }
        } catch (error) {
            this.showError('Gagal menambah varian: ' + error.message);
        }
    },

    async editVarian(varianId) {
        const barang = this.products.find(b => b.id === this.currentVarianBarangId);
        if (!barang) return;
        
        const varian = barang.varian.find(v => v.id === varianId);
        if (!varian) return;

        const namaVarian = prompt('Nama Varian:', varian.nama_varian);
        if (namaVarian === null) return;
        
        const harga = prompt('Harga:', varian.harga);
        if (harga === null) return;
        
        const hargaEcer = prompt('Harga Ecer:', varian.harga_ecer || 0);
        if (hargaEcer === null) return;
        
        const stok = prompt('Stok:', varian.stok);
        if (stok === null) return;

        try {
            await API.updateVarian(varianId, {
                nama_varian: namaVarian.trim(),
                harga: parseInt(harga) || 0,
                harga_ecer: parseInt(hargaEcer) || 0,
                stok: parseInt(stok) || 0
            });
            
            this.showSuccess('Varian berhasil diupdate!');
            await this.loadBarang();
            
            const updatedBarang = this.products.find(b => b.id === this.currentVarianBarangId);
            if (updatedBarang) {
                this.renderVarianTable(updatedBarang.varian || []);
            }
        } catch (error) {
            this.showError('Gagal update varian: ' + error.message);
        }
    },

    async hapusVarian(varianId) {
        if (!confirm('Yakin ingin menghapus varian ini?')) return;

        try {
            await API.deleteVarian(varianId);
            this.showSuccess('Varian berhasil dihapus!');
            await this.loadBarang();
            
            const barang = this.products.find(b => b.id === this.currentVarianBarangId);
            if (barang) {
                this.renderVarianTable(barang.varian || []);
            }
        } catch (error) {
            this.showError('Gagal menghapus varian: ' + error.message);
        }
    },

    // ==========================================
    // Import/Export
    // ==========================================

    showImportExport() {
        document.getElementById('modal-import-export').style.display = 'flex';
    },

    hideImportExport() {
        document.getElementById('modal-import-export').style.display = 'none';
    },

    downloadTemplateEmptyCSV() {
        window.location.href = API.getTemplateEmptyCSVUrl();
    },

    downloadTemplateEmptyExcel() {
        window.location.href = API.getTemplateEmptyExcelUrl();
    },

    downloadTemplateDataCSV() {
        window.location.href = API.getTemplateDataCSVUrl();
    },

    downloadTemplateDataExcel() {
        window.location.href = API.getTemplateDataExcelUrl();
    },

    exportCSV() {
        window.location.href = API.getExportCSVUrl();
    },

    exportExcel() {
        window.location.href = API.getExportExcelUrl();
    },

    async importFile() {
        const fileInput = document.getElementById('import-file');
        const file = fileInput.files[0];

        if (!file) {
            this.showError('Pilih file terlebih dahulu!');
            return;
        }

        try {
            let result;
            if (file.name.endsWith('.csv')) {
                result = await API.importCSV(file);
            } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                result = await API.importExcel(file);
            } else {
                this.showError('Format file tidak didukung!');
                return;
            }

            this.showSuccess(result.message);
            this.hideImportExport();
            await this.loadKategori();
            await this.loadBarang();
            fileInput.value = '';
        } catch (error) {
            this.showError('Gagal import: ' + error.message);
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
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    Barang.init();
});
