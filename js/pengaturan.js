/**
 * Settings Module - Receipt Settings & Backup Management
 */

const Settings = {
    settings: {},

    async init() {
        await this.loadSettings();
        this.loadApiUrl();
    },

    async loadSettings() {
        try {
            this.settings = await API.getSettings();
            
            // Fill form fields
            document.getElementById('store-name').value = this.settings.store_name || '';
            document.getElementById('store-address').value = this.settings.store_address || '';
            document.getElementById('store-phone').value = this.settings.store_phone || '';
            document.getElementById('receipt-footer').value = this.settings.receipt_footer || '';

            // Set price type radio
            const priceType = this.settings.price_type || 'harga_utama';
            if (priceType === 'harga_ecer') {
                document.getElementById('price-type-ecer').checked = true;
            } else {
                document.getElementById('price-type-utama').checked = true;
            }

            // Update preview
            this.updatePreview();

            // Add live preview listeners
            document.getElementById('store-name').addEventListener('input', () => this.updatePreview());
            document.getElementById('store-address').addEventListener('input', () => this.updatePreview());
            document.getElementById('store-phone').addEventListener('input', () => this.updatePreview());
            document.getElementById('receipt-footer').addEventListener('input', () => this.updatePreview());

        } catch (error) {
            this.showError('Gagal memuat pengaturan: ' + error.message);
        }
    },

    updatePreview() {
        const name = document.getElementById('store-name').value || 'TOKO ANDA';
        const address = document.getElementById('store-address').value || 'Alamat toko';
        const phone = document.getElementById('store-phone').value || '08xxxxxxxxx';
        const footer = document.getElementById('receipt-footer').value || 'Terima kasih!';

        document.getElementById('preview-name').textContent = name;
        document.getElementById('preview-address').textContent = address;
        document.getElementById('preview-phone').textContent = 'Telp: ' + phone;
        document.getElementById('preview-footer').textContent = footer;
    },

    async saveReceipt() {
        const data = {
            store_name: document.getElementById('store-name').value.trim(),
            store_address: document.getElementById('store-address').value.trim(),
            store_phone: document.getElementById('store-phone').value.trim(),
            receipt_footer: document.getElementById('receipt-footer').value.trim()
        };

        try {
            await API.updateSettings(data);
            this.showSuccess('Pengaturan berhasil disimpan!');
        } catch (error) {
            this.showError('Gagal menyimpan: ' + error.message);
        }
    },

    async savePriceType() {
        const priceType = document.querySelector('input[name="price-type"]:checked').value;
        
        try {
            await API.updateSettings({ price_type: priceType });
            this.showSuccess('Pengaturan harga berhasil disimpan!');
        } catch (error) {
            this.showError('Gagal menyimpan: ' + error.message);
        }
    },

    backupDatabase() {
        window.location.href = API.getBackupUrl();
    },

    confirmRestore(input) {
        const file = input.files[0];
        if (!file) return;

        const statusEl = document.getElementById('restore-status');
        
        // Confirm before restore
        const confirmed = confirm(
            `PERINGATAN!\n\n` +
            `Anda akan me-restore database dari file:\n"${file.name}"\n\n` +
            `Semua data saat ini (barang, transaksi, pengaturan) akan DIGANTI dengan data dari file backup.\n\n` +
            `Database saat ini akan di-backup otomatis sebelum restore.\n\n` +
            `Lanjutkan?`
        );

        if (!confirmed) {
            input.value = '';
            return;
        }

        this.restoreDatabase(file, statusEl, input);
    },

    async restoreDatabase(file, statusEl, input) {
        statusEl.innerHTML = '<span style="color: var(--gray-500);">Memproses restore...</span>';

        try {
            const result = await API.restoreDatabase(file);
            statusEl.innerHTML = `<span style="color: var(--success);">✓ ${result.message}</span>`;
            
            // Reload settings after restore
            this.showSuccess('Database berhasil di-restore! Halaman akan dimuat ulang...');
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } catch (error) {
            statusEl.innerHTML = `<span style="color: var(--danger);">✗ ${error.message}</span>`;
            this.showError('Gagal restore: ' + error.message);
        }

        input.value = '';
    },

    // ==========================================
    // API URL Settings
    // ==========================================

    loadApiUrl() {
        const apiUrl = localStorage.getItem('api_url') || 'http://localhost:8000';
        document.getElementById('api-url').value = apiUrl;
    },

    saveApiUrl() {
        const url = document.getElementById('api-url').value.trim();
        if (!url) {
            this.showError('URL tidak boleh kosong!');
            return;
        }

        API.setBaseURL(url);
        this.showSuccess('URL API berhasil disimpan!');
    },

    async testConnection() {
        const statusEl = document.getElementById('connection-status');
        statusEl.innerHTML = '<span style="color: var(--gray-500);">Memeriksa koneksi...</span>';

        try {
            const connected = await API.checkConnection();
            if (connected) {
                statusEl.innerHTML = '<span style="color: var(--success);">✓ Terhubung ke API</span>';
            } else {
                statusEl.innerHTML = '<span style="color: var(--danger);">✗ Tidak dapat terhubung</span>';
            }
        } catch (error) {
            statusEl.innerHTML = `<span style="color: var(--danger);">✗ ${error.message}</span>`;
        }
    },

    // ==========================================
    // Reset Database
    // ==========================================

    confirmResetDatabase() {
        // First confirmation
        const confirm1 = confirm(
            '⚠️ PERINGATAN!\n\n' +
            'Anda akan menghapus SEMUA data:\n' +
            '- Semua barang dan kategori\n' +
            '- Semua riwayat transaksi\n' +
            '- Semua varian produk\n\n' +
            'Tindakan ini TIDAK BISA dibatalkan!\n\n' +
            'Apakah Anda yakin ingin melanjutkan?'
        );
        
        if (!confirm1) return;
        
        // Second confirmation - require typing
        const confirmText = prompt(
            'KONFIRMASI TERAKHIR\n\n' +
            'Untuk melanjutkan, ketik "HAPUS SEMUA" (huruf besar):\n'
        );
        
        if (confirmText !== 'HAPUS SEMUA') {
            this.showError('Reset dibatalkan. Teks konfirmasi tidak sesuai.');
            return;
        }
        
        // Execute reset
        this.executeResetDatabase();
    },
    
    async executeResetDatabase() {
        try {
            this.showSuccess('Sedang mereset database...');
            
            await API.resetDatabase();
            
            this.showSuccess('Database berhasil direset! Halaman akan dimuat ulang...');
            
            // Reload page after 2 seconds
            setTimeout(() => {
                window.location.reload();
            }, 2000);
            
        } catch (error) {
            this.showError('Gagal mereset database: ' + error.message);
        }
    },

    // ==========================================
    // Reset Transaksi Only
    // ==========================================

    confirmResetTransaksi() {
        const confirm1 = confirm(
            '⚠️ PERINGATAN!\n\n' +
            'Anda akan menghapus SEMUA riwayat transaksi:\n' +
            '- Semua transaksi yang tercatat\n' +
            '- Semua pesanan yang ditahan (hold orders)\n\n' +
            'Data barang, kategori, dan pengaturan TIDAK akan dihapus.\n\n' +
            'Tindakan ini TIDAK BISA dibatalkan!\n\n' +
            'Apakah Anda yakin ingin melanjutkan?'
        );
        
        if (!confirm1) return;
        
        const confirmText = prompt(
            'KONFIRMASI\n\n' +
            'Untuk melanjutkan, ketik "HAPUS TRANSAKSI" (huruf besar):\n'
        );
        
        if (confirmText !== 'HAPUS TRANSAKSI') {
            this.showError('Penghapusan dibatalkan. Teks konfirmasi tidak sesuai.');
            return;
        }
        
        this.executeResetTransaksi();
    },

    async executeResetTransaksi() {
        try {
            this.showSuccess('Sedang menghapus transaksi...');
            
            const result = await API.resetTransaksi();
            
            this.showSuccess(result.message);
            
        } catch (error) {
            this.showError('Gagal menghapus transaksi: ' + error.message);
        }
    },

    // ==========================================
    // Reset Barang Only
    // ==========================================

    confirmResetBarang() {
        const includeKategori = document.getElementById('reset-barang-kategori')?.checked || false;
        
        let warningText = '⚠️ PERINGATAN!\n\n' +
            'Anda akan menghapus SEMUA data barang:\n' +
            '- Semua barang\n' +
            '- Semua varian produk\n';
        
        if (includeKategori) {
            warningText += '- Semua kategori\n';
        }
        
        warningText += '\nData transaksi dan pengaturan TIDAK akan dihapus.\n\n' +
            'Tindakan ini TIDAK BISA dibatalkan!\n\n' +
            'Apakah Anda yakin ingin melanjutkan?';
        
        const confirm1 = confirm(warningText);
        
        if (!confirm1) return;
        
        const confirmText = prompt(
            'KONFIRMASI\n\n' +
            'Untuk melanjutkan, ketik "HAPUS BARANG" (huruf besar):\n'
        );
        
        if (confirmText !== 'HAPUS BARANG') {
            this.showError('Penghapusan dibatalkan. Teks konfirmasi tidak sesuai.');
            return;
        }
        
        this.executeResetBarang(includeKategori);
    },

    async executeResetBarang(includeKategori) {
        try {
            this.showSuccess('Sedang menghapus barang...');
            
            const result = await API.resetBarang(includeKategori);
            
            this.showSuccess(result.message);
            
        } catch (error) {
            this.showError('Gagal menghapus barang: ' + error.message);
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
    Settings.init();
});
