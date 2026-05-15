// --- Financial Record Module ---
// This module handles transactions grouped by recordId (each "Cashed Book")

export function initFinancial(globalState, switchView, saveGlobalData) {
    const container = document.getElementById('financial-items');
    const recordId = globalState.currentFinancialRecordId;
    const record = globalState.financialRecords.find(r => r.id === recordId);
    
    // Set UI Title & Description
    if (record) {
        document.getElementById('fin-record-title').textContent = record.title;
        document.getElementById('fin-record-desc-display').textContent = record.description || '';
    }

    // Load transactions for THIS specific record
    let allFinancialData = JSON.parse(localStorage.getItem('financial_records_data')) || {};
    let transactions = allFinancialData[recordId] || [];
    
    let searchQuery = '';

    window.toggleFinSearch = () => {
        const searchContainer = document.getElementById('fin-search-container');
        const searchInput = document.getElementById('fin-search-input');
        const isHidden = searchContainer.classList.contains('hidden');
        
        if (isHidden) {
            searchContainer.classList.remove('hidden');
            searchInput.focus();
        } else {
            searchContainer.classList.add('hidden');
            searchInput.value = '';
            searchQuery = '';
            renderFinancial();
        }
    };

    window.closeFinModal = () => {
        document.getElementById('fin-modal').classList.add('hidden');
    };

    const searchInput = document.getElementById('fin-search-input');
    if (searchInput) {
        searchInput.replaceWith(searchInput.cloneNode(true)); // Clear listeners
        const newSearchInput = document.getElementById('fin-search-input');
        newSearchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase();
            renderFinancial();
        });
    }

    function saveFinancialData() {
        // Read fresh data to avoid overwriting other records
        const freshData = JSON.parse(localStorage.getItem('financial_records_data')) || {};
        freshData[recordId] = transactions;
        localStorage.setItem('financial_records_data', JSON.stringify(freshData));
        // Trigger Drive sync via global saveData (debounced)
        saveGlobalData();
    }

    window.renderFinancial = () => {
        container.innerHTML = '';
        
        // Filter Transactions based on search
        const filteredTransactions = transactions.filter(t => {
            const noteMatch = (t.note || '').toLowerCase().includes(searchQuery);
            const typeMatch = t.type.toLowerCase().includes(searchQuery);
            const amountMatch = t.amount.toString().includes(searchQuery);
            return noteMatch || typeMatch || amountMatch;
        });

        // Calculate Totals
        const totalIncome = transactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + Number(t.amount), 0);
            
        const totalExpense = transactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + Number(t.amount), 0);
            
        const balance = totalIncome - totalExpense;

        // Update UI Summary
        const balanceText = `${window.appCurrency} ${balance.toLocaleString('id-ID')}`;
        document.getElementById('total-balance').textContent = balanceText;
        document.getElementById('total-income').textContent = `+${window.appCurrency} ${totalIncome.toLocaleString('id-ID')}`;
        document.getElementById('total-expense').textContent = `-${window.appCurrency} ${totalExpense.toLocaleString('id-ID')}`;
        
        document.getElementById('header-balance').textContent = balanceText;
        document.getElementById('header-income').textContent = totalIncome.toLocaleString('id-ID');
        document.getElementById('header-expense').textContent = totalExpense.toLocaleString('id-ID');

        const view = document.getElementById('financial-view');
        const stickyHeader = document.getElementById('fin-sticky-header');
        const subHeader = document.getElementById('fin-sub-header');
        const largeSummary = document.getElementById('fin-large-summary');

        view.onscroll = () => {
            const scrollPos = view.scrollTop;
            const threshold = 100; 
            if (scrollPos > threshold) {
                subHeader.style.opacity = '1';
                subHeader.style.transform = 'translateY(0)';
                subHeader.style.pointerEvents = 'auto';
                stickyHeader.classList.add('border-gray-200');
                largeSummary.style.opacity = '0';
                largeSummary.style.transform = 'scale(0.9) translateY(-20px)';
            } else {
                subHeader.style.opacity = '0';
                subHeader.style.transform = 'translateY(10px)';
                subHeader.style.pointerEvents = 'none';
                stickyHeader.classList.remove('border-gray-200');
                largeSummary.style.opacity = '1';
                largeSummary.style.transform = 'scale(1) translateY(0)';
            }
        };

        if (filteredTransactions.length === 0) {
            container.innerHTML = `<div class="py-20 text-center opacity-30 text-sm font-bold uppercase tracking-widest">No transactions found</div>`;
            return;
        }

        filteredTransactions.sort((a, b) => b.timestamp - a.timestamp).forEach(t => {
            const date = new Date(t.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const div = document.createElement('div');
            div.className = "flex items-center justify-between p-5 bg-white rounded-3xl border border-gray-50 mb-3 active:scale-95 transition-all cursor-pointer";
            div.innerHTML = `
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 ${t.type === 'income' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'} rounded-2xl flex items-center justify-center">
                        ${t.type === 'income' 
                            ? '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7 7 7M12 3v18"></path></svg>'
                            : '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7-7-7M12 21V3"></path></svg>'
                        }
                    </div>
                    <div>
                        <p class="font-bold text-[#1D1D1F]">${t.note || (t.type === 'income' ? 'Income' : 'Expense')}</p>
                        <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">${date}</p>
                    </div>
                </div>
                <p class="font-black ${t.type === 'income' ? 'text-green-500' : 'text-red-500'} tabular-nums">
                    ${t.type === 'income' ? '+' : '-'}${window.appCurrency} ${Number(t.amount).toLocaleString('id-ID')}
                </p>
            `;
            
            div.onclick = () => {
                window.editTransaction(t.id);
            };
            container.appendChild(div);
        });
    };

    window.editTransaction = (id) => {
        const t = transactions.find(item => item.id === id);
        if (!t) return;

        globalState.editingTransactionId = id;
        
        // Show delete button
        document.getElementById('btn-delete-transaction').classList.remove('hidden');
        document.getElementById('delete-spacer').classList.add('hidden');
        
        // Fill form
        document.getElementById('fin-amount').value = Number(t.amount).toLocaleString('id-ID');
        document.getElementById('fin-note').value = t.note || '';
        
        window.openModal('fin-modal');
    };

    window.openTransactionModal = () => {
        globalState.editingTransactionId = null;
        
        // Hide delete button
        document.getElementById('btn-delete-transaction').classList.add('hidden');
        document.getElementById('delete-spacer').classList.remove('hidden');
        
        // Clear form
        document.getElementById('fin-amount').value = '';
        document.getElementById('fin-note').value = '';
        
        window.openModal('fin-modal');
    };

    const deleteBtn = document.getElementById('btn-delete-transaction');
    if (deleteBtn) {
        deleteBtn.onclick = () => {
            if (!globalState.editingTransactionId) return;
            
            window.showConfirm({
                title: "Delete Transaction?",
                message: "Are you sure you want to remove this record?",
                confirmText: "Delete",
                isDestructive: true,
                onConfirm: () => {
                    transactions = transactions.filter(tr => tr.id !== globalState.editingTransactionId);
                    saveFinancialData();
                    window.closeModal('fin-modal');
                    renderFinancial();
                }
            });
        };
    }

    const amountInput = document.getElementById('fin-amount');
    if (amountInput) {
        amountInput.addEventListener('input', (e) => {
            // Keep digits and comma for Indonesian decimal format
            let raw = e.target.value.replace(/[^\d,]/g, '');
            // Ensure only one comma
            const commaIdx = raw.indexOf(',');
            if (commaIdx !== -1) raw = raw.slice(0, commaIdx + 1) + raw.slice(commaIdx + 1).replace(/,/g, '');
            e.target.value = raw;
        });
    }

    // Form Handling
    const handleAddTransaction = (type) => {
        let amountStr = document.getElementById('fin-amount').value;
        // Replace comma with dot for JS number parsing (Indonesian format)
        amountStr = amountStr.replace(',', '.').replace(/[^\d.]/g, '');
        const amount = Number(amountStr);
        const note = document.getElementById('fin-note').value;

        if (isNaN(amount) || amount <= 0) return;

        if (globalState.editingTransactionId) {
            // Update existing
            const t = transactions.find(item => item.id === globalState.editingTransactionId);
            if (t) {
                t.amount = amount;
                t.note = note;
                t.type = type;
            }
        } else {
            // Add new
            const newTransaction = {
                id: Date.now(),
                amount: amount,
                note: note,
                type: type,
                timestamp: Date.now()
            };
            transactions.push(newTransaction);
        }

        saveFinancialData();
        
        // Reset and close
        document.getElementById('fin-amount').value = '';
        document.getElementById('fin-note').value = '';
        window.closeModal('fin-modal');
        renderFinancial();
    };

    const incomeBtn = document.getElementById('btn-add-income');
    const expenseBtn = document.getElementById('btn-add-expense');

    if (incomeBtn) incomeBtn.onclick = () => handleAddTransaction('income');
    if (expenseBtn) expenseBtn.onclick = () => handleAddTransaction('expense');

    renderFinancial();
}
