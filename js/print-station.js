/**
 * Print Station Module
 * Polls print_queue from database for print requests
 * Only shows items explicitly sent to Print Station
 */

const PrintStation = {
    // State
    pollingInterval: 3000, // 3 seconds default
    pollingTimer: null,
    isOnline: false,
    soundEnabled: true,
    queue: [],
    previousQueueLength: 0,
    lastPrintedInfo: null,

    // LocalStorage keys (for UI settings only)
    STORAGE_KEY_POLLING: 'print_station_polling_interval',
    STORAGE_KEY_SOUND: 'print_station_sound_enabled',

    /**
     * Initialize Print Station
     */
    async init() {
        console.log('🖨️ Print Station initializing...');

        // Load UI settings from localStorage
        this.loadSettings();

        // Load print settings for receipt
        await this.loadPrintSettings();

        // Update UI with settings
        this.updateSettingsUI();

        // Start polling
        this.startPolling();

        // Initial check
        await this.checkPrintQueue();

        console.log('🖨️ Print Station ready!');
    },

    /**
     * Load UI settings from localStorage
     */
    loadSettings() {
        // Polling interval
        const savedPolling = localStorage.getItem(this.STORAGE_KEY_POLLING);
        if (savedPolling) {
            this.pollingInterval = parseInt(savedPolling) || 3000;
        }

        // Sound enabled
        const savedSound = localStorage.getItem(this.STORAGE_KEY_SOUND);
        if (savedSound !== null) {
            this.soundEnabled = savedSound === 'true';
        }
    },

    /**
     * Update settings UI with loaded values
     */
    updateSettingsUI() {
        document.getElementById('polling-input').value = this.pollingInterval / 1000;
        document.getElementById('polling-interval').textContent = this.pollingInterval / 1000;
        document.getElementById('sound-enabled').checked = this.soundEnabled;
    },

    /**
     * Load print settings from API
     */
    async loadPrintSettings() {
        try {
            const settings = await API.getSettings();
            if (typeof PrintHelper !== 'undefined') {
                PrintHelper.setStoreInfo({
                    name: settings.store_name || 'TOKO ANDA',
                    address: settings.store_address || '',
                    phone: settings.store_phone || ''
                });
                PrintHelper.receiptFooter = settings.receipt_footer || 'Terima kasih!';
            }
        } catch (e) {
            console.log('Could not load print settings');
        }
    },

    /**
     * Start polling for print queue
     */
    startPolling() {
        // Clear existing timer if any
        if (this.pollingTimer) {
            clearInterval(this.pollingTimer);
        }

        // Start new polling timer
        this.pollingTimer = setInterval(() => {
            this.checkPrintQueue();
        }, this.pollingInterval);

        console.log(`Polling started: every ${this.pollingInterval / 1000}s`);
    },

    /**
     * Check print queue from database
     */
    async checkPrintQueue() {
        this.setStatus('checking', 'Memeriksa...');

        try {
            // Get print queue from API
            this.queue = await API.getPrintQueue();

            // Update status
            this.setStatus('online', 'Terhubung');
            this.isOnline = true;

            // Check if there are new items since last check
            if (this.queue.length > this.previousQueueLength && this.previousQueueLength >= 0) {
                // Play notification sound
                this.playNotificationSound();
            }
            this.previousQueueLength = this.queue.length;

            // Render queue
            this.renderQueue();

        } catch (error) {
            console.error('Polling error:', error);
            this.setStatus('offline', 'Tidak terhubung');
            this.isOnline = false;
            this.renderQueue();
        }
    },

    /**
     * Set status display
     */
    setStatus(status, text) {
        const dot = document.getElementById('status-dot');
        const textEl = document.getElementById('status-text');

        dot.className = 'status-dot ' + status;
        textEl.textContent = text;
    },

    /**
     * Render queue list
     */
    renderQueue() {
        const queueList = document.getElementById('queue-list');
        const queueCount = document.getElementById('queue-count');

        // Update count badge
        queueCount.textContent = this.queue.length;
        queueCount.className = 'queue-count' + (this.queue.length === 0 ? ' empty' : '');

        // Render list
        if (this.queue.length === 0) {
            queueList.innerHTML = `
                <div class="queue-empty">
                    <div class="icon">✅</div>
                    <p>Tidak ada antrian cetak</p>
                    <p style="font-size: 0.85rem; margin-top: 0.5rem; color: var(--gray-400);">
                        Kirim transaksi dari HP untuk mencetak di sini
                    </p>
                </div>
            `;
            return;
        }

        queueList.innerHTML = this.queue.map((item, index) => {
            const dateTime = this.formatDateTime(item.transaksi_date);
            const queuedAt = this.formatDateTime(item.queued_at);
            const isFirst = index === 0;

            return `
                <div class="queue-item ${isFirst ? 'first' : ''}">
                    <div class="queue-item-info">
                        <h3>#${item.transaksi_id}</h3>
                        <div class="meta">${dateTime}</div>
                        ${item.nama_pelanggan ? `<div class="customer">👤 ${item.nama_pelanggan}</div>` : ''}
                        <div class="queued-at" style="font-size: 0.75rem; color: var(--gray-400);">
                            Dikirim: ${queuedAt}
                        </div>
                    </div>
                    <div class="queue-item-total">${this.formatRupiah(item.total)}</div>
                    <button class="btn-print" onclick="PrintStation.printTransaction(${item.id}, ${item.transaksi_id})">
                        🖨️ CETAK
                    </button>
                </div>
            `;
        }).join('');
    },

    /**
     * Print a transaction
     * @param {number} queueId - The queue item ID (for removal)
     * @param {number} transaksiId - The transaction ID (for getting details)
     */
    async printTransaction(queueId, transaksiId) {
        try {
            // Get full transaction details
            const transaction = await API.getTransaksiById(transaksiId);

            // Remove from queue BEFORE showing print dialog
            await API.removeFromPrintQueue(queueId);

            // Update last printed info
            this.lastPrintedInfo = {
                id: transaksiId,
                total: transaction.total,
                time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
            };
            this.updateLastPrintedDisplay();

            // Remove from local queue immediately
            this.queue = this.queue.filter(item => item.id !== queueId);
            this.renderQueue();

            // Print using PrintHelper
            if (typeof PrintHelper !== 'undefined') {
                PrintHelper.printReceipt(transaction);
            }

            // Refresh queue after a short delay
            setTimeout(() => {
                this.checkPrintQueue();
            }, 500);

        } catch (error) {
            console.error('Print error:', error);
            alert('Gagal mencetak: ' + error.message);
        }
    },

    /**
     * Update last printed display
     */
    updateLastPrintedDisplay() {
        const el = document.getElementById('last-printed-info');
        if (this.lastPrintedInfo) {
            el.textContent = `#${this.lastPrintedInfo.id} - ${this.formatRupiah(this.lastPrintedInfo.total)} (${this.lastPrintedInfo.time})`;
        } else {
            el.textContent = 'Belum ada';
        }
    },

    /**
     * Play notification sound
     */
    playNotificationSound() {
        if (!this.soundEnabled) return;

        try {
            // Create a simple beep sound
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 800;
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
        } catch (e) {
            console.log('Could not play notification sound');
        }
    },

    /**
     * Update polling interval
     */
    updatePollingInterval() {
        const input = document.getElementById('polling-input');
        let value = parseInt(input.value) || 3;

        // Clamp between 1 and 30 seconds
        value = Math.max(1, Math.min(30, value));
        input.value = value;

        this.pollingInterval = value * 1000;
        localStorage.setItem(this.STORAGE_KEY_POLLING, this.pollingInterval.toString());
        document.getElementById('polling-interval').textContent = value;

        // Restart polling with new interval
        this.startPolling();
    },

    /**
     * Toggle sound notification
     */
    toggleSound() {
        this.soundEnabled = document.getElementById('sound-enabled').checked;
        localStorage.setItem(this.STORAGE_KEY_SOUND, this.soundEnabled.toString());
    },

    /**
     * Clear all items from print queue
     */
    async clearQueue() {
        if (this.queue.length === 0) {
            alert('Antrian sudah kosong.');
            return;
        }

        if (!confirm(`Hapus ${this.queue.length} item dari antrian?\n\nItem yang dihapus tidak akan dicetak.`)) {
            return;
        }

        try {
            await API.clearPrintQueue();
            this.queue = [];
            this.renderQueue();
            this.previousQueueLength = 0;
        } catch (error) {
            alert('Gagal menghapus antrian: ' + error.message);
        }
    },

    /**
     * Format date time
     */
    formatDateTime(dateStr) {
        const d = new Date(dateStr);
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear();
        const hours = d.getHours().toString().padStart(2, '0');
        const minutes = d.getMinutes().toString().padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}`;
    },

    /**
     * Format rupiah
     */
    formatRupiah(amount) {
        return 'Rp ' + amount.toLocaleString('id-ID');
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    PrintStation.init();
});
