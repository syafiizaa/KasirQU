/**
 * API Module - Handles all communication with backend
 * Default API URL: http://localhost:8000
 */

const API = {
    // Base URL - auto-detect or use saved URL
    // When served via nginx proxy, use empty string (same origin)
    // When developing locally, use localhost:8000
    baseURL: localStorage.getItem('api_url') || (window.location.port === '3000' ? 'http://localhost:8000' : ''),

    /**
     * Set custom API base URL
     */
    setBaseURL(url) {
        this.baseURL = url.replace(/\/$/, '');
        localStorage.setItem('api_url', this.baseURL);
    },

    /**
     * Generic fetch wrapper with error handling
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            },
        };

        const config = { ...defaultOptions, ...options };
        
        if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
            config.body = JSON.stringify(config.body);
        }
        
        // Remove Content-Type for FormData
        if (options.body instanceof FormData) {
            delete config.headers['Content-Type'];
        }

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                // Handle FastAPI validation errors (422)
                if (error.detail && Array.isArray(error.detail)) {
                    const messages = error.detail.map(e => e.msg || e.message || JSON.stringify(e)).join(', ');
                    throw new Error(messages || `Validation Error: ${response.status}`);
                }
                throw new Error(error.detail || error.message || `HTTP Error: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
                throw new Error('Tidak dapat terhubung ke server. Pastikan backend berjalan.');
            }
            throw error;
        }
    },

    // ==========================================
    // Barang (Product) Endpoints
    // ==========================================

    async getBarang(kategoriId = null) {
        const query = kategoriId ? `?kategori_id=${kategoriId}` : '';
        return await this.request(`/api/barang${query}`);
    },

    async getBarangById(id) {
        return await this.request(`/api/barang/${id}`);
    },

    async createBarang(data) {
        return await this.request('/api/barang', {
            method: 'POST',
            body: data,
        });
    },

    async updateBarang(id, data) {
        return await this.request(`/api/barang/${id}`, {
            method: 'PUT',
            body: data,
        });
    },

    async deleteBarang(id) {
        return await this.request(`/api/barang/${id}`, {
            method: 'DELETE',
        });
    },

    async generateKodeBarang() {
        return await this.request('/api/barang/generate-kode');
    },

    // ==========================================
    // Varian (Product Variant) Endpoints
    // ==========================================

    async getVarianByBarang(barangId) {
        return await this.request(`/api/varian/barang/${barangId}`);
    },

    async getBarangWithVarian() {
        return await this.request('/api/varian/all/with-products');
    },

    async createVarian(data) {
        return await this.request('/api/varian', {
            method: 'POST',
            body: data,
        });
    },

    async updateVarian(id, data) {
        return await this.request(`/api/varian/${id}`, {
            method: 'PUT',
            body: data,
        });
    },

    async deleteVarian(id) {
        return await this.request(`/api/varian/${id}`, {
            method: 'DELETE',
        });
    },

    // ==========================================
    // Kategori (Category) Endpoints
    // ==========================================

    async getKategori() {
        return await this.request('/api/kategori');
    },

    async createKategori(data) {
        return await this.request('/api/kategori', {
            method: 'POST',
            body: data,
        });
    },

    async updateKategori(id, data) {
        return await this.request(`/api/kategori/${id}`, {
            method: 'PUT',
            body: data,
        });
    },

    async deleteKategori(id) {
        return await this.request(`/api/kategori/${id}`, {
            method: 'DELETE',
        });
    },

    // ==========================================
    // Transaksi (Transaction) Endpoints
    // ==========================================

    async getTransaksi(filters = {}) {
        const params = new URLSearchParams();
        if (filters.limit) params.append('limit', filters.limit);
        if (filters.start_date) params.append('start_date', filters.start_date);
        if (filters.end_date) params.append('end_date', filters.end_date);
        if (filters.month) params.append('month', filters.month);
        if (filters.year) params.append('year', filters.year);
        if (filters.nama_pelanggan) params.append('nama_pelanggan', filters.nama_pelanggan);
        
        const query = params.toString() ? `?${params.toString()}` : '';
        return await this.request(`/api/transaksi${query}`);
    },

    async getTransaksiById(id) {
        return await this.request(`/api/transaksi/${id}`);
    },

    async createTransaksi(data) {
        return await this.request('/api/transaksi', {
            method: 'POST',
            body: data,
        });
    },

    async updateTransaksi(id, data) {
        return await this.request(`/api/transaksi/${id}`, {
            method: 'PUT',
            body: data,
        });
    },

    async deleteTransaksi(id) {
        return await this.request(`/api/transaksi/${id}`, {
            method: 'DELETE',
        });
    },

    // ==========================================
    // Settings Endpoints
    // ==========================================

    async getSettings() {
        return await this.request('/api/settings');
    },

    async updateSettings(data) {
        return await this.request('/api/settings', {
            method: 'PUT',
            body: data,
        });
    },

    getBackupUrl() {
        return `${this.baseURL}/api/settings/backup`;
    },

    async restoreDatabase(file) {
        const formData = new FormData();
        formData.append('file', file);
        
        return await this.request('/api/settings/restore', {
            method: 'POST',
            body: formData,
        });
    },

    async resetDatabase() {
        return await this.request('/api/settings/reset', {
            method: 'POST',
        });
    },

    async resetTransaksi() {
        return await this.request('/api/settings/reset/transaksi', {
            method: 'POST',
        });
    },

    async resetBarang(includeKategori = false) {
        return await this.request('/api/settings/reset/barang', {
            method: 'POST',
            body: { include_kategori: includeKategori },
        });
    },

    // ==========================================
    // Hold Orders Endpoints
    // ==========================================

    async getHoldOrders() {
        return await this.request('/api/settings/hold-orders');
    },

    async createHoldOrder(data) {
        return await this.request('/api/settings/hold-orders', {
            method: 'POST',
            body: data,
        });
    },

    async deleteHoldOrder(id) {
        return await this.request(`/api/settings/hold-orders/${id}`, {
            method: 'DELETE',
        });
    },

    // ==========================================
    // Print Queue Endpoints
    // ==========================================

    async getPrintQueue() {
        return await this.request('/api/settings/print-queue');
    },

    async addToPrintQueue(transaksiId) {
        return await this.request('/api/settings/print-queue', {
            method: 'POST',
            body: { transaksi_id: transaksiId },
        });
    },

    async addItemListToPrintQueue(itemListData) {
        console.log('API: addItemListToPrintQueue called with:', itemListData);
        const result = await this.request('/api/settings/print-queue/item-list', {
            method: 'POST',
            body: itemListData,
        });
        console.log('API: addItemListToPrintQueue response:', result);
        return result;
    },

    async removeFromPrintQueue(queueId) {
        return await this.request(`/api/settings/print-queue/${queueId}`, {
            method: 'DELETE',
        });
    },

    async clearPrintQueue() {
        return await this.request('/api/settings/print-queue', {
            method: 'DELETE',
        });
    },

    // ==========================================
    // Export/Import Endpoints
    // ==========================================

    getTemplateEmptyCSVUrl() {
        return `${this.baseURL}/api/export/template/empty/csv`;
    },

    getTemplateDataCSVUrl() {
        return `${this.baseURL}/api/export/template/data/csv`;
    },

    getTemplateEmptyExcelUrl() {
        return `${this.baseURL}/api/export/template/empty/excel`;
    },

    getTemplateDataExcelUrl() {
        return `${this.baseURL}/api/export/template/data/excel`;
    },

    getExportCSVUrl() {
        return `${this.baseURL}/api/export/barang/csv`;
    },

    getExportExcelUrl() {
        return `${this.baseURL}/api/export/barang/excel`;
    },

    async importCSV(file) {
        const formData = new FormData();
        formData.append('file', file);
        
        return await this.request('/api/export/barang/import/csv', {
            method: 'POST',
            body: formData,
        });
    },

    async importExcel(file) {
        const formData = new FormData();
        formData.append('file', file);
        
        return await this.request('/api/export/barang/import/excel', {
            method: 'POST',
            body: formData,
        });
    },

    // ==========================================
    // Activity Log Endpoints
    // ==========================================

    async getActivityLogs(limit = 100, type = null) {
        let query = `?limit=${limit}`;
        if (type) {
            query += `&type=${type}`;
        }
        return await this.request(`/api/settings/activity-log${query}`);
    },

    async getActivityLogStats() {
        return await this.request('/api/settings/activity-log/stats');
    },

    async clearActivityLogs() {
        return await this.request('/api/settings/activity-log', {
            method: 'DELETE',
        });
    },

    async deleteOldActivityLogs(days = 30) {
        return await this.request(`/api/settings/activity-log/old?days=${days}`, {
            method: 'DELETE',
        });
    },

    // ==========================================
    // Utility Methods
    // ==========================================

    async checkConnection() {
        try {
            await this.request('/api/health');
            return true;
        } catch {
            return false;
        }
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
}
