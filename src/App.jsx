import { useEffect, useMemo, useState } from 'react'
import './App.css'

const API_BASE = import.meta.env.VITE_API_BASE || ''

const formatMoney = (value) => {
  const numberValue = Number(value) || 0
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(numberValue)
}

const emptyAccountForm = {
  name: '',
  type: 'bank',
  initialBalance: '',
}

const emptySplitDraft = {
  name: '',
  amount: '',
}

const emptyTxDraft = {
  type: 'expense',
  amount: '',
  splitId: '',
  description: '',
}

const emptyAdjustDraft = {
  actualBalance: '',
  description: '',
}

const apiGet = async (path) => {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error('Request failed')
  return res.json()
}

const apiPost = async (path, body) => {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    const message = payload?.error || 'Request failed'
    throw new Error(message)
  }
  return res.json()
}

const apiPatch = async (path, body) => {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    const message = payload?.error || 'Request failed'
    throw new Error(message)
  }
  return res.json()
}

const apiDelete = async (path) => {
  const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE' })
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    const message = payload?.error || 'Request failed'
    throw new Error(message)
  }
  return res.json()
}

export default function App() {
  const [accounts, setAccounts] = useState([])
  const [summary, setSummary] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [accountForm, setAccountForm] = useState(emptyAccountForm)
  const [splitDrafts, setSplitDrafts] = useState({})
  const [txDrafts, setTxDrafts] = useState({})
  const [adjustDrafts, setAdjustDrafts] = useState({})
  const [splitEdits, setSplitEdits] = useState({})
  const [splitEditOpen, setSplitEditOpen] = useState({})

  const refresh = async () => {
    setLoading(true)
    setError('')
    try {
      const [accountsData, summaryData, transactionsData] = await Promise.all([
        apiGet('/api/accounts'),
        apiGet('/api/summary'),
        apiGet('/api/transactions?limit=100'),
      ])
      setAccounts(accountsData)
      setSummary(summaryData)
      setTransactions(transactionsData)
    } catch (err) {
      setError(err.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const accountMap = useMemo(() => {
    const map = new Map()
    accounts.forEach((account) => map.set(account._id, account))
    return map
  }, [accounts])

  const splitMap = useMemo(() => {
    const map = new Map()
    accounts.forEach((account) => {
      account.splits?.forEach((split) => map.set(split._id, split))
    })
    return map
  }, [accounts])

  const adjustments = useMemo(
    () => transactions.filter((tx) => tx.type === 'adjustment'),
    [transactions]
  )

  const unknownExpense = adjustments.filter((tx) => (tx.meta?.delta ?? 0) < 0)
  const unknownIncome = adjustments.filter((tx) => (tx.meta?.delta ?? 0) > 0)

  const handleCreateAccount = async (event) => {
    event.preventDefault()
    try {
      await apiPost('/api/accounts', {
        name: accountForm.name.trim(),
        type: accountForm.type,
        initialBalance: Number(accountForm.initialBalance) || 0,
      })
      setAccountForm(emptyAccountForm)
      await refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleSplitChange = (accountId, field, value) => {
    setSplitDrafts((prev) => ({
      ...prev,
      [accountId]: { ...(prev[accountId] || emptySplitDraft), [field]: value },
    }))
  }

  const handleCreateSplit = async (event, accountId) => {
    event.preventDefault()
    const draft = splitDrafts[accountId] || emptySplitDraft
    try {
      await apiPost(`/api/accounts/${accountId}/splits`, {
        name: draft.name.trim(),
        amount: Number(draft.amount) || 0,
      })
      setSplitDrafts((prev) => ({ ...prev, [accountId]: emptySplitDraft }))
      await refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleSplitEditOpen = (split) => {
    setSplitEditOpen((prev) => ({ ...prev, [split._id]: true }))
    setSplitEdits((prev) => ({
      ...prev,
      [split._id]: { name: split.name, amount: split.balance },
    }))
  }

  const handleSplitEditChange = (splitId, field, value) => {
    setSplitEdits((prev) => ({
      ...prev,
      [splitId]: { ...(prev[splitId] || emptySplitDraft), [field]: value },
    }))
  }

  const handleSplitEditCancel = (splitId) => {
    setSplitEditOpen((prev) => ({ ...prev, [splitId]: false }))
  }

  const handleSplitUpdate = async (event, accountId, splitId) => {
    event.preventDefault()
    const draft = splitEdits[splitId] || emptySplitDraft
    try {
      await apiPatch(`/api/accounts/${accountId}/splits/${splitId}`, {
        name: draft.name.trim(),
        amount: Number(draft.amount) || 0,
      })
      setSplitEditOpen((prev) => ({ ...prev, [splitId]: false }))
      await refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleSplitDelete = async (accountId, splitId) => {
    if (!window.confirm('Delete this split?')) return
    try {
      await apiDelete(`/api/accounts/${accountId}/splits/${splitId}`)
      await refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleTxChange = (accountId, field, value) => {
    setTxDrafts((prev) => ({
      ...prev,
      [accountId]: { ...(prev[accountId] || emptyTxDraft), [field]: value },
    }))
  }

  const handleCreateTx = async (event, accountId) => {
    event.preventDefault()
    const draft = txDrafts[accountId] || emptyTxDraft
    try {
      await apiPost('/api/transactions', {
        type: draft.type,
        accountId,
        splitId: draft.splitId || undefined,
        amount: Number(draft.amount) || 0,
        description: draft.description.trim(),
      })
      setTxDrafts((prev) => ({ ...prev, [accountId]: emptyTxDraft }))
      await refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleAdjustChange = (accountId, field, value) => {
    setAdjustDrafts((prev) => ({
      ...prev,
      [accountId]: { ...(prev[accountId] || emptyAdjustDraft), [field]: value },
    }))
  }

  const handleCreateAdjustment = async (event, accountId) => {
    event.preventDefault()
    const draft = adjustDrafts[accountId] || emptyAdjustDraft
    try {
      await apiPost('/api/transactions', {
        type: 'adjustment',
        accountId,
        actualBalance: Number(draft.actualBalance) || 0,
        description: draft.description.trim(),
      })
      setAdjustDrafts((prev) => ({ ...prev, [accountId]: emptyAdjustDraft }))
      await refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleClearHistory = async () => {
    if (!window.confirm('Clear all history?')) return
    try {
      await apiDelete('/api/transactions')
      await refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  const renderUnknownList = (items) => {
    if (!items.length) return <p className="muted">No entries.</p>
    return (
      <div className="transactions">
        {items.map((tx) => {
          const account = accountMap.get(tx.accountId)
          const split = splitMap.get(tx.splitId)
          return (
            <div className="transaction-row" key={tx._id}>
              <div>
                <p className="tx-title">{tx.description || 'Unknown'}</p>
                <p className="tx-meta">
                  {account?.name || 'Unknown account'}
                  {split ? ` / ${split.name}` : ''}
                </p>
              </div>
              <div className="tx-amount">
                <span>{new Date(tx.createdAt).toLocaleString()}</span>
                <strong className={(tx.meta?.delta ?? 0) < 0 ? 'negative' : ''}>
                  {formatMoney(tx.amount)}
                </strong>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">MyMoney Control Room</p>
          <h1>Track cash, banks, and every split in one place.</h1>
          <p className="subhead">
            Add accounts, split money by purpose, and see unknown spends instantly.
          </p>
        </div>
        <div className="summary-card">
          <p className="summary-label">Grand Total</p>
          <p className="summary-value">
            {formatMoney(summary?.totalsByType?.grandTotal || 0)}
          </p>
          <div className="summary-breakdown">
            <span>Bank</span>
            <strong>{formatMoney(summary?.totalsByType?.bank || 0)}</strong>
            <span>Cash</span>
            <strong>{formatMoney(summary?.totalsByType?.cash || 0)}</strong>
          </div>
        </div>
      </header>

      <section className="panel">
        <div className="panel-header">
          <h2>Add Account</h2>
          <p>Create bank or cash wallets anytime.</p>
        </div>
        <form className="form-grid" onSubmit={handleCreateAccount}>
          <input
            type="text"
            placeholder="Account name"
            value={accountForm.name}
            onChange={(event) => setAccountForm({ ...accountForm, name: event.target.value })}
            required
          />
          <select
            value={accountForm.type}
            onChange={(event) => setAccountForm({ ...accountForm, type: event.target.value })}
          >
            <option value="bank">Bank</option>
            <option value="cash">Cash</option>
          </select>
          <input
            type="number"
            placeholder="Initial balance"
            value={accountForm.initialBalance}
            onChange={(event) =>
              setAccountForm({ ...accountForm, initialBalance: event.target.value })
            }
          />
          <button type="submit">Create Account</button>
        </form>
      </section>

      {error && <div className="error-banner">{error}</div>}
      {loading && <div className="loading">Loading data...</div>}

      <section className="accounts">
        {accounts.map((account) => {
          const splitDraft = splitDrafts[account._id] || emptySplitDraft
          const txDraft = txDrafts[account._id] || emptyTxDraft
          const adjustDraft = adjustDrafts[account._id] || emptyAdjustDraft

          return (
            <article
              className={`account-card account-${account.type}`}
              key={account._id}
            >
              <div className="account-header">
                <div>
                  <p className="account-type">{account.type.toUpperCase()}</p>
                  <h3>{account.name}</h3>
                </div>
                <div className="account-balance">
                  <span>Total</span>
                  <strong>{formatMoney(account.balance)}</strong>
                </div>
              </div>

              <div className="account-metrics">
                <div>
                  <p>Allocated</p>
                  <strong>{formatMoney(account.allocated)}</strong>
                </div>
                <div>
                  <p>Unallocated</p>
                  <strong>{formatMoney(account.unallocated)}</strong>
                </div>
              </div>

              <div className="split-list">
                {account.splits?.length ? (
                  account.splits.map((split) => {
                    const isEditing = splitEditOpen[split._id]
                    const editDraft = splitEdits[split._id] || {
                      name: split.name,
                      amount: split.balance,
                    }
                    return (
                      <div className="split-block" key={split._id}>
                        <div className="split-row">
                          <span>{split.name}</span>
                          <strong>{formatMoney(split.balance)}</strong>
                          <div className="split-actions">
                            <button
                              className="ghost"
                              type="button"
                              onClick={() => handleSplitEditOpen(split)}
                            >
                              Edit
                            </button>
                            <button
                              className="danger"
                              type="button"
                              onClick={() => handleSplitDelete(account._id, split._id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        {isEditing && (
                          <form
                            className="split-edit"
                            onSubmit={(event) =>
                              handleSplitUpdate(event, account._id, split._id)
                            }
                          >
                            <input
                              type="text"
                              value={editDraft.name}
                              onChange={(event) =>
                                handleSplitEditChange(split._id, 'name', event.target.value)
                              }
                            />
                            <input
                              type="number"
                              value={editDraft.amount}
                              onChange={(event) =>
                                handleSplitEditChange(split._id, 'amount', event.target.value)
                              }
                            />
                            <button type="submit">Save</button>
                            <button
                              className="ghost"
                              type="button"
                              onClick={() => handleSplitEditCancel(split._id)}
                            >
                              Cancel
                            </button>
                          </form>
                        )}
                      </div>
                    )
                  })
                ) : (
                  <p className="muted">No splits yet. Add one below.</p>
                )}
              </div>

              <form className="form-grid" onSubmit={(event) => handleCreateSplit(event, account._id)}>
                <input
                  type="text"
                  placeholder="Split name"
                  value={splitDraft.name}
                  onChange={(event) => handleSplitChange(account._id, 'name', event.target.value)}
                  required
                />
                <input
                  type="number"
                  placeholder="Split amount"
                  value={splitDraft.amount}
                  onChange={(event) => handleSplitChange(account._id, 'amount', event.target.value)}
                />
                <button type="submit">Add Split</button>
              </form>

              <form className="form-grid" onSubmit={(event) => handleCreateTx(event, account._id)}>
                <select
                  value={txDraft.type}
                  onChange={(event) => handleTxChange(account._id, 'type', event.target.value)}
                >
                  <option value="income">Add Money</option>
                  <option value="expense">Spend Money</option>
                </select>
                <input
                  type="number"
                  placeholder="Amount"
                  value={txDraft.amount}
                  onChange={(event) => handleTxChange(account._id, 'amount', event.target.value)}
                  required
                />
                <select
                  value={txDraft.splitId}
                  onChange={(event) => handleTxChange(account._id, 'splitId', event.target.value)}
                >
                  <option value="">No split</option>
                  {account.splits?.map((split) => (
                    <option value={split._id} key={split._id}>
                      {split.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Description"
                  value={txDraft.description}
                  onChange={(event) => handleTxChange(account._id, 'description', event.target.value)}
                />
                <button type="submit">Save Transaction</button>
              </form>

              <form
                className="form-grid"
                onSubmit={(event) => handleCreateAdjustment(event, account._id)}
              >
                <input
                  type="number"
                  placeholder="Actual balance"
                  value={adjustDraft.actualBalance}
                  onChange={(event) =>
                    handleAdjustChange(account._id, 'actualBalance', event.target.value)
                  }
                  required
                />
                <input
                  type="text"
                  placeholder="Adjustment note (optional)"
                  value={adjustDraft.description}
                  onChange={(event) =>
                    handleAdjustChange(account._id, 'description', event.target.value)
                  }
                />
                <button type="submit">Reconcile Balance</button>
              </form>
            </article>
          )
        })}
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Unknown Spending</h2>
          <p>From reconciliation when actual balance was lower.</p>
        </div>
        {renderUnknownList(unknownExpense)}
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Unknown Income</h2>
          <p>From reconciliation when actual balance was higher.</p>
        </div>
        {renderUnknownList(unknownIncome)}
      </section>

      <section className="panel recent-panel">
        <div className="panel-header">
          <div>
            <h2>Recent Activity</h2>
            <p>Every action you take stays here as history.</p>
          </div>
          <button className="ghost" type="button" onClick={handleClearHistory}>
            Clear history
          </button>
        </div>
        <div className="transactions">
          {transactions.length ? (
            transactions.map((tx) => {
              const account = accountMap.get(tx.accountId)
              const split = splitMap.get(tx.splitId)
              const delta = tx.meta?.delta
              return (
                <div className="transaction-row" key={tx._id}>
                  <div>
                    <p className="tx-title">{tx.description || tx.type}</p>
                    <p className="tx-meta">
                      {account?.name || 'Unknown account'}
                      {split ? ` / ${split.name}` : ''}
                      {tx.type === 'adjustment'
                        ? delta < 0
                          ? ' / Unknown expense'
                          : ' / Unknown income'
                        : ''}
                    </p>
                  </div>
                  <div className="tx-amount">
                    <span>{new Date(tx.createdAt).toLocaleString()}</span>
                    <strong className={tx.type === 'expense' || delta < 0 ? 'negative' : ''}>
                      {tx.type === 'expense' || delta < 0 ? '-' : '+'}
                      {formatMoney(tx.amount)}
                    </strong>
                  </div>
                </div>
              )
            })
          ) : (
            <p className="muted">No transactions yet.</p>
          )}
        </div>
      </section>
    </div>
  )
}
