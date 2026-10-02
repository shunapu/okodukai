const STORAGE_KEY = "okodukai-transactions";
const currency = new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0
});
const categoryIcons = {
    "食べもの": "🍙",
    "あそび": "🎈",
    "おやつ": "🍪",
    "本・学び": "📚",
    "その他": "🌱",
    "おこづかい": "🎁"
};

const form = document.querySelector("#transaction-form");
const typeInput = document.querySelector("#type");
const amountInput = document.querySelector("#amount");
const categoryInput = document.querySelector("#category");
const dateInput = document.querySelector("#date");
const memoInput = document.querySelector("#memo");
const list = document.querySelector("#transaction-list");
const emptyState = document.querySelector("#empty-state");
const formMessage = document.querySelector("#form-message");

let transactions = loadTransactions();

dateInput.value = getLocalDate();
document.querySelectorAll(".type-button").forEach((button) => {
    button.addEventListener("click", () => {
        const isIncome = button.dataset.type === "income";
        typeInput.value = isIncome ? "income" : "expense";
        document.querySelectorAll(".type-button").forEach((choice) => {
            const selected = choice === button;
            choice.classList.toggle("is-selected", selected);
            choice.setAttribute("aria-pressed", String(selected));
        });
        categoryInput.value = isIncome ? "おこづかい" : "食べもの";
        formMessage.textContent = "";
    });
});

form.addEventListener("submit", (event) => {
    event.preventDefault();
    formMessage.textContent = "";

    const amount = Number(amountInput.value);
    if (!Number.isSafeInteger(amount) || amount < 1) {
        formMessage.textContent = "金額は1円以上の整数で入力してください。";
        amountInput.focus();
        return;
    }

    const transaction = {
        id: createId(),
        type: typeInput.value,
        amount,
        category: categoryInput.value,
        date: dateInput.value,
        memo: memoInput.value.trim()
    };
    const updatedTransactions = [transaction, ...transactions];

    if (!saveTransactions(updatedTransactions)) {
        formMessage.textContent = "保存できませんでした。ブラウザーの設定を確認してください。";
        return;
    }

    transactions = updatedTransactions;
    form.reset();
    document.querySelectorAll(".type-button").forEach((button) => {
        const selected = button.dataset.type === "expense";
        button.classList.toggle("is-selected", selected);
        button.setAttribute("aria-pressed", String(selected));
    });
    dateInput.value = getLocalDate();
    render();
    amountInput.focus();
});

list.addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete-id]");
    if (!button) return;

    const updatedTransactions = transactions.filter((item) => item.id !== button.dataset.deleteId);
    if (!saveTransactions(updatedTransactions)) {
        formMessage.textContent = "記録を削除できませんでした。ブラウザーの設定を確認してください。";
        return;
    }

    transactions = updatedTransactions;
    formMessage.textContent = "";
    render();
});

function getLocalDate() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60_000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function createId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function loadTransactions() {
    try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        if (!Array.isArray(stored)) return [];
        return stored.filter((item) =>
            item &&
            typeof item.id === "string" &&
            (item.type === "income" || item.type === "expense") &&
            Number.isSafeInteger(item.amount) &&
            item.amount > 0 &&
            typeof item.category === "string" &&
            typeof item.date === "string" &&
            typeof item.memo === "string"
        );
    } catch (error) {
        console.error("おこづかい帳の記録を読み込めませんでした。", error);
        return [];
    }
}

function saveTransactions(nextTransactions) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextTransactions));
        return true;
    } catch (error) {
        console.error("おこづかい帳の記録を保存できませんでした。", error);
        return false;
    }
}

function formatDate(dateString) {
    const [year, month, day] = dateString.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return new Intl.DateTimeFormat("ja-JP", {
        month: "short",
        day: "numeric",
        weekday: "short"
    }).format(date);
}

function render() {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const balance = transactions.reduce(
        (total, item) => total + (item.type === "income" ? item.amount : -item.amount),
        0
    );
    const monthlyIncome = transactions
        .filter((item) => item.type === "income" && item.date.startsWith(thisMonth))
        .reduce((total, item) => total + item.amount, 0);
    const monthlyExpense = transactions
        .filter((item) => item.type === "expense" && item.date.startsWith(thisMonth))
        .reduce((total, item) => total + item.amount, 0);

    document.querySelector("#balance").textContent = currency.format(balance);
    document.querySelector("#monthly-income").textContent = currency.format(monthlyIncome);
    document.querySelector("#monthly-expense").textContent = currency.format(monthlyExpense);
    document.querySelector("#record-count").textContent = `${transactions.length}件`;
    list.replaceChildren();
    emptyState.hidden = transactions.length > 0;

    transactions.forEach((item) => {
        const row = document.createElement("li");
        row.className = "transaction-item";

        const icon = document.createElement("span");
        icon.className = "transaction-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = item.type === "income" ? (categoryIcons[item.category] || "🎁") : (categoryIcons[item.category] || "🌱");

        const details = document.createElement("div");
        details.className = "transaction-details";
        const title = document.createElement("p");
        title.className = "transaction-title";
        title.textContent = item.memo || item.category;
        const meta = document.createElement("p");
        meta.className = "transaction-meta";
        meta.textContent = `${formatDate(item.date)} ・ ${item.category}`;
        details.append(title, meta);

        const amount = document.createElement("span");
        amount.className = `transaction-amount is-${item.type}`;
        amount.textContent = `${item.type === "income" ? "+" : "−"}${currency.format(item.amount)}`;

        const deleteButton = document.createElement("button");
        deleteButton.className = "delete-button";
        deleteButton.type = "button";
        deleteButton.dataset.deleteId = item.id;
        deleteButton.setAttribute("aria-label", `${item.memo || item.category}の記録を削除`);
        deleteButton.textContent = "×";

        row.append(icon, details, amount, deleteButton);
        list.append(row);
    });
}

render();
