const STORAGE_KEY = "okodukai-family";
const LEGACY_STORAGE_KEY = "okodukai-transactions";
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
const profileForm = document.querySelector("#profile-form");
const profileNameInput = document.querySelector("#profile-name");
const profileList = document.querySelector("#profile-list");
const profileMessage = document.querySelector("#profile-message");
const typeInput = document.querySelector("#type");
const amountInput = document.querySelector("#amount");
const categoryInput = document.querySelector("#category");
const dateInput = document.querySelector("#date");
const memoInput = document.querySelector("#memo");
const list = document.querySelector("#transaction-list");
const emptyState = document.querySelector("#empty-state");
const formMessage = document.querySelector("#form-message");
const balanceSection = document.querySelector("#balance-section");
const entrySection = document.querySelector("#entry-section");
const historySection = document.querySelector("#history-section");

let appState = loadState();

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

profileForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = profileNameInput.value.trim();
    if (!name) {
        profileMessage.textContent = "名前を入力してください。";
        profileNameInput.focus();
        return;
    }

    const profile = { id: createId(), name, transactions: [] };
    const nextState = {
        profiles: [...appState.profiles, profile],
        activeProfileId: profile.id
    };
    if (!saveState(nextState)) {
        profileMessage.textContent = "保存できませんでした。ブラウザーの設定を確認してください。";
        return;
    }

    appState = nextState;
    profileForm.reset();
    profileMessage.textContent = "";
    formMessage.textContent = "";
    render();
});

profileList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-profile-id]");
    if (!button || button.dataset.profileId === appState.activeProfileId) return;

    const nextState = { ...appState, activeProfileId: button.dataset.profileId };
    if (!saveState(nextState)) {
        profileMessage.textContent = "切り替えを保存できませんでした。ブラウザーの設定を確認してください。";
        return;
    }
    appState = nextState;
    profileMessage.textContent = "";
    formMessage.textContent = "";
    render();
});

form.addEventListener("submit", (event) => {
    event.preventDefault();
    formMessage.textContent = "";

    const profile = getActiveProfile();
    if (!profile) {
        formMessage.textContent = "先に家族の名前を登録してください。";
        return;
    }

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
    const nextState = updateActiveTransactions([transaction, ...profile.transactions]);

    if (!saveState(nextState)) {
        formMessage.textContent = "保存できませんでした。ブラウザーの設定を確認してください。";
        return;
    }

    appState = nextState;
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

    const profile = getActiveProfile();
    if (!profile) return;
    const updatedTransactions = profile.transactions.filter((item) => item.id !== button.dataset.deleteId);
    const nextState = updateActiveTransactions(updatedTransactions);
    if (!saveState(nextState)) {
        formMessage.textContent = "記録を削除できませんでした。ブラウザーの設定を確認してください。";
        return;
    }

    appState = nextState;
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

function isValidTransaction(item) {
    return item &&
        typeof item.id === "string" &&
        (item.type === "income" || item.type === "expense") &&
        Number.isSafeInteger(item.amount) &&
        item.amount > 0 &&
        typeof item.category === "string" &&
        typeof item.date === "string" &&
        typeof item.memo === "string";
}

function loadState() {
    try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        if (
            stored &&
            Array.isArray(stored.profiles) &&
            stored.profiles.every((profile) =>
                profile &&
                typeof profile.id === "string" &&
                typeof profile.name === "string" &&
                Array.isArray(profile.transactions) &&
                profile.transactions.every(isValidTransaction)
            ) &&
            (stored.activeProfileId === null ||
                stored.profiles.some((profile) => profile.id === stored.activeProfileId))
        ) {
            return stored;
        }

        const legacyTransactions = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || "[]");
        if (Array.isArray(legacyTransactions) && legacyTransactions.length > 0) {
            const profile = {
                id: "legacy-profile",
                name: "自分",
                transactions: legacyTransactions.filter(isValidTransaction)
            };
            const migrated = { profiles: [profile], activeProfileId: profile.id };
            saveState(migrated);
            return migrated;
        }
    } catch (error) {
        console.error("おこづかい帳のデータを読み込めませんでした。", error);
    }
    return { profiles: [], activeProfileId: null };
}

function saveState(nextState) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
        return true;
    } catch (error) {
        console.error("おこづかい帳のデータを保存できませんでした。", error);
        return false;
    }
}

function getActiveProfile() {
    return appState.profiles.find((profile) => profile.id === appState.activeProfileId) || null;
}

function updateActiveTransactions(transactions) {
    return {
        ...appState,
        profiles: appState.profiles.map((profile) =>
            profile.id === appState.activeProfileId ? { ...profile, transactions } : profile
        )
    };
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
    const profile = getActiveProfile();
    profileList.replaceChildren();
    appState.profiles.forEach((item) => {
        const button = document.createElement("button");
        button.className = "profile-button";
        button.type = "button";
        button.dataset.profileId = item.id;
        button.setAttribute("aria-pressed", String(item.id === appState.activeProfileId));
        button.textContent = item.name;
        profileList.append(button);
    });
    document.querySelector("#profile-form-label").textContent =
        appState.profiles.length === 0 ? "あなたの名前" : "家族の名前";
    document.querySelector("#profile-submit-label").textContent =
        appState.profiles.length === 0 ? "はじめる" : "追加";

    const hasProfile = profile !== null;
    balanceSection.hidden = !hasProfile;
    entrySection.hidden = !hasProfile;
    historySection.hidden = !hasProfile;
    document.querySelector("#app-title").textContent =
        hasProfile ? `${profile.name}のおこづかい帳` : "おこづかい帳";
    if (!hasProfile) {
        emptyState.hidden = false;
        emptyState.textContent = "まず名前を登録して、おこづかい帳をはじめよう！";
        return;
    }

    emptyState.textContent = "まだ記録がありません。最初の記録をつけてみよう！";
    const transactions = profile.transactions;
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
