# SB Credit Card & Gift Card Tracker — Architecture

## What It Does

A personal finance tracker for managing credit card spending, gift card balances (Amazon/Flipkart), and cashback estimates. All data persists in the browser via `localStorage`.

### Core Flows

1. **Card Spend** — Log a direct credit card purchase with optional savings/discount amount
2. **Buy Gift Card** — Purchase a gift card (Amazon/Flipkart) using the credit card. Creates a trackable gift card with a balance.
3. **Spend Gift Card** — Use an existing gift card for a purchase. Deducts from the selected card's remaining balance.

### Dashboard Metrics

| Metric | Calculation |
|---|---|
| SB Card Utilized | Sum of all card + gift card purchase amounts |
| Amazon Gift Left | Sum of remaining balance on Amazon gift cards |
| Flipkart Gift Left | Sum of remaining balance on Flipkart gift cards |
| Total Gift Cards Left | All remaining gift card balances combined |
| This Month Spend | All transactions in the current calendar month |
| Est. Cashback | 1% of total card utilization |
| You Saved (Offers) | Sum of all savings/discount fields |

---

## Architecture Diagram

```mermaid
graph TB
    subgraph Browser["Browser (Client-Side Only)"]
        direction TB

        subgraph UI["UI Layer"]
            App["App.jsx"]
            Tracker["SBCashbackTracker.jsx"]
            SummaryCards["SummaryCard × 7"]
            InputForm["Transaction Input Form"]
            GiftCardList["Gift Card List"]
            TxnList["Transaction List"]
        end

        subgraph State["State Management (React hooks)"]
            TxnState["transactions\n(useState)"]
            GCState["giftCards\n(useState)"]
            FormState["form\n(useState)"]
            SummaryMemo["summary\n(useMemo)"]
        end

        subgraph Persistence["Persistence Layer"]
            LS_TXN["localStorage\nsb-transactions"]
            LS_GC["localStorage\nsb-giftcards"]
        end

        subgraph Actions["Business Logic"]
            AddTxn["addTransaction()"]
            RemoveTxn["removeTransaction()"]
        end
    end

    App --> Tracker
    Tracker --> InputForm
    Tracker --> SummaryCards
    Tracker --> GiftCardList
    Tracker --> TxnList

    InputForm -- "user submits" --> AddTxn
    TxnList -- "delete click" --> RemoveTxn

    AddTxn -- "type=giftcard_purchase" --> GCState
    AddTxn -- "type=giftcard_spend" --> GCState
    AddTxn --> TxnState
    RemoveTxn --> TxnState

    TxnState -- "useEffect sync" --> LS_TXN
    GCState -- "useEffect sync" --> LS_GC
    LS_TXN -- "initial load" --> TxnState
    LS_GC -- "initial load" --> GCState

    TxnState --> SummaryMemo
    GCState --> SummaryMemo
    SummaryMemo --> SummaryCards

    style Browser fill:#f8fafc,stroke:#334155
    style UI fill:#e0f2fe,stroke:#0284c7
    style State fill:#fef3c7,stroke:#d97706
    style Persistence fill:#dcfce7,stroke:#16a34a
    style Actions fill:#fce7f3,stroke:#db2777
```

---

## Component Tree

```mermaid
graph TD
    A["App"] --> B["SBCashbackTracker"]
    B --> C["Card (Input Form)"]
    B --> D["SummaryCard × 7"]
    B --> E["Card (Gift Card List)"]
    B --> F["Card (Transaction List)"]

    C --> C1["Input (date)"]
    C --> C2["Input (description)"]
    C --> C3["Input (amount)"]
    C --> C4["Input (savings)"]
    C --> C5["Select (type)"]
    C --> C6["Select (wallet)"]
    C --> C7["Select (gift card)"]
    C --> C8["Button (Add)"]

    F --> F1["Button (Delete)"]
```

---

## Data Flow

```mermaid
sequenceDiagram
    participant User
    participant Form
    participant State
    participant LocalStorage
    participant Dashboard

    User->>Form: Fill transaction details
    Form->>State: addTransaction()
    
    alt type = giftcard_purchase
        State->>State: Create new gift card entry
    end
    
    alt type = giftcard_spend
        State->>State: Deduct from selected gift card
    end

    State->>State: Append to transactions[]
    State->>LocalStorage: useEffect → persist
    State->>Dashboard: useMemo → recalculate summary
    Dashboard->>User: Updated metrics
```

---

## File Structure

```
src/
├── main.jsx                          # Entry point
├── App.jsx                           # Root component
├── index.css                         # Tailwind CSS + theme tokens
├── components/
│   ├── SBCashbackTracker.jsx         # Main tracker (all logic + UI)
│   └── ui/
│       ├── button.jsx                # Button (shadcn-style)
│       ├── card.jsx                  # Card + CardContent
│       ├── input.jsx                 # Input
│       └── select.jsx               # Select (Radix UI based)
└── lib/
    └── utils.js                      # cn() utility (clsx + tailwind-merge)
```

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 (Vite) |
| Styling | Tailwind CSS v4 |
| UI Components | shadcn/ui pattern (Radix UI primitives) |
| Animation | Framer Motion |
| Icons | Lucide React |
| Persistence | Browser localStorage |
| Build | Vite 7 |
