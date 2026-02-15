/**
 * Print Module - Handles receipt printing for 58mm thermal printer
 * Uses window.print() for browser-based printing
 * Uses inline styles for better compatibility with Android/thermal printers
 */

const PrintHelper = {
    // Store info - will be loaded from settings
    storeName: 'TOKO ANDA',
    storeAddress: 'Jl. Contoh No. 123',
    storePhone: '08123456789',
    receiptFooter: 'Terima kasih atas kunjungan Anda!',

    /**
     * Format number as Indonesian Rupiah
     */
    formatRupiah(amount) {
        return 'Rp ' + amount.toLocaleString('id-ID');
    },

    /**
     * Format number for print (without Rp prefix)
     */
    formatNumber(amount) {
        return amount.toLocaleString('id-ID');
    },

    /**
     * Format date and time
     */
    formatDateTime(date) {
        const d = new Date(date);
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear();
        const hours = d.getHours().toString().padStart(2, '0');
        const minutes = d.getMinutes().toString().padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}`;
    },

    /**
     * Generate receipt HTML content with inline styles
     */
    generateReceiptHTML(transaksi) {
        const items = transaksi.items || [];
        
        // Inline styles for maximum compatibility
        // All text bold, vertical layout for receipt info
        const styles = {
            container: 'width:48mm;max-width:48mm;font-family:Courier New,monospace;font-size:12px;font-weight:bold;line-height:1.0;color:#000;background:#fff;padding:0;',
            header: 'text-align:center;margin-bottom:0;padding-bottom:0;border-bottom:1px dashed #000;',
            storeName: 'font-size:16px;font-weight:bold;margin:0;',
            storeInfo: 'font-size:13px;font-weight:bold;margin:0;',
            infoRow: 'display:flex;justify-content:space-between;font-size:13px;font-weight:bold;margin:0;',
            divider: 'border-top:1px dashed #000;margin:2mm 0;',
            item: 'margin-bottom:0;',
            itemName: 'font-size:14px;font-weight:bold;word-wrap:break-word;white-space:normal;',
            itemDetail: 'display:flex;justify-content:space-between;font-size:14px;font-weight:bold;color:#000;padding-left:2mm;',
            total: 'display:flex;justify-content:space-between;font-weight:bold;font-size:16px;margin:0;',
            footer: 'text-align:center;margin-top:1mm;padding-top:0;font-size:12px;font-weight:bold;'
        };
        
        let itemsHTML = items.map(item => {
            const itemName = item.nama_barang.replace(' - ', ' ');
            return `
            <div style="${styles.item}">
                <div style="${styles.itemName}">${itemName}</div>
                <div style="${styles.itemDetail}">
                    <span>${item.qty} x ${this.formatNumber(item.harga)}</span>
                    <span>${this.formatNumber(item.subtotal)}</span>
                </div>
            </div>
        `;
        }).join('');

        // Format date and time separately
        const dateTimeStr = this.formatDateTime(transaksi.created_at || new Date());
        const [dateStr, timeStr] = dateTimeStr.split(' ');

        return `
            <div style="${styles.container}">
                <div style="${styles.header}">
                    <div style="${styles.storeName}">${this.storeName}</div>
                    <p style="${styles.storeInfo}">${this.storeAddress}</p>
                    <p style="${styles.storeInfo}">WA: ${this.storePhone}</p>
                </div>
                
                <div style="${styles.infoRow}">
                    <span>No Nota</span>
                    <span>#${transaksi.id}</span>
                </div>
                <div style="${styles.infoRow}">
                    <span>Tanggal</span>
                    <span>${dateStr}</span>
                </div>
                <div style="${styles.infoRow}">
                    <span>Waktu</span>
                    <span>${timeStr}</span>
                </div>
                
                <div style="${styles.divider}"></div>
                
                <div>
                    ${itemsHTML}
                </div>
                
                <div style="${styles.divider}"></div>
                
                <div style="${styles.total}">
                    <span>TOTAL</span>
                    <span>${this.formatNumber(transaksi.total)}</span>
                </div>
                
                <div style="${styles.divider}"></div>
                
                <div style="${styles.footer}">
                    <p style="margin:0;">${this.receiptFooter}</p>
                </div>
            </div>
        `;
    },

    /**
     * Prepare receipt area for printing
     */
    prepareReceipt(transaksi) {
        const receiptArea = document.getElementById('receipt-area');
        if (receiptArea) {
            receiptArea.innerHTML = this.generateReceiptHTML(transaksi);
        }
    },

    /**
     * Print the receipt using window.print()
     */
    printReceipt(transaksi) {
        // Prepare receipt content
        this.prepareReceipt(transaksi);
        
        // Small delay to ensure content is rendered
        setTimeout(() => {
            window.print();
        }, 100);
    },

    /**
     * Update store information
     */
    setStoreInfo(info) {
        if (info.name) this.storeName = info.name;
        if (info.address) this.storeAddress = info.address;
        if (info.phone) this.storePhone = info.phone;
    },

    /**
     * Load settings from API
     */
    async loadSettings() {
        try {
            const settings = await API.getSettings();
            this.storeName = settings.store_name || 'TOKO ANDA';
            this.storeAddress = settings.store_address || '';
            this.storePhone = settings.store_phone || '';
            this.receiptFooter = settings.receipt_footer || 'Terima kasih!';
        } catch (e) {
            console.log('Could not load print settings');
        }
    },

    /**
     * Generate Item List HTML (without prices) for packing/check list
     * Shows: item name, qty, and catatan (notes)
     * @param {Object} data - { nama_pelanggan, items: [{nama_barang, qty, catatan}], tanggal }
     * @param {Object} settings - Store settings (optional)
     */
    generateItemListHTML(data, settings = {}) {
        const items = data.items || [];
        
        // Use provided settings or defaults (same as main receipt)
        const storeAddress = settings.store_address || this.storeAddress;
        const storePhone = settings.store_phone || this.storePhone;
        
        // Inline styles - same as main receipt for consistency
        const styles = {
            container: 'width:48mm;max-width:48mm;font-family:Courier New,monospace;font-size:12px;font-weight:bold;line-height:1.0;color:#000;background:#fff;padding:0;',
            header: 'text-align:center;margin-bottom:0;padding-bottom:0;border-bottom:1px dashed #000;',
            listTitle: 'font-size:16px;font-weight:bold;margin:0;',
            storeInfo: 'font-size:13px;font-weight:bold;margin:0;',
            infoRow: 'display:flex;justify-content:space-between;font-size:13px;font-weight:bold;margin:0;',
            divider: 'border-top:1px dashed #000;margin:2mm 0;',
            item: 'margin-bottom:2mm;',
            itemRow: 'display:flex;align-items:flex-start;font-size:14px;font-weight:bold;',
            itemQty: 'min-width:30px;text-align:left;',
            itemName: 'flex:1;word-wrap:break-word;white-space:normal;padding-left:2mm;',
            itemNote: 'font-size:12px;color:#000;padding-left:32px;font-style:italic;margin-top:0;',
            footer: 'text-align:center;margin-top:1mm;padding-top:0;font-size:11px;font-weight:bold;'
        };

        // Format date and time same as main receipt
        const dateTimeStr = this.formatDateTime(data.created_at || new Date());
        const [dateStr, timeStr] = dateTimeStr.split(' ');
        
        let itemsHTML = items.map((item, index) => {
            const itemName = item.nama_barang.replace(' - ', ' ');
            const noteHtml = item.catatan 
                ? `<div style="${styles.itemNote}">→ ${item.catatan}</div>` 
                : '';
            
            return `
            <div style="${styles.item}">
                <div style="${styles.itemRow}">
                    <span style="${styles.itemQty}">${item.qty}x</span>
                    <span style="${styles.itemName}">${itemName}</span>
                </div>
                ${noteHtml}
            </div>
        `;
        }).join('');

        // Build customer section
        const customerSection = data.nama_pelanggan 
            ? `<div style="${styles.infoRow}"><span>Pelanggan</span><span>${data.nama_pelanggan}</span></div>`
            : '';

        return `
            <div style="${styles.container}">
                <div style="${styles.header}">
                    <div style="${styles.listTitle}">LIST BARANG</div>
                    <p style="${styles.storeInfo}">${storeAddress}</p>
                    <p style="${styles.storeInfo}">WA: ${storePhone}</p>
                </div>
                
                ${customerSection}
                <div style="${styles.infoRow}">
                    <span>Tanggal</span>
                    <span>${dateStr}</span>
                </div>
                <div style="${styles.infoRow}">
                    <span>Waktu</span>
                    <span>${timeStr}</span>
                </div>
                <div style="${styles.infoRow}">
                    <span>Total Item</span>
                    <span>${items.reduce((sum, i) => sum + i.qty, 0)} pcs</span>
                </div>
                
                <div style="${styles.divider}"></div>
                
                <div>
                    ${itemsHTML}
                </div>
                
                <div style="${styles.divider}"></div>
                
                <div style="${styles.footer}">
                    <p style="margin:0;">List ini BUKAN bukti pembayaran</p>
                </div>
            </div>
        `;
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PrintHelper;
}
