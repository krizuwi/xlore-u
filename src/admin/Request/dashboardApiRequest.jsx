import { API_URL, api } from "../../lib/api.js";

export async function FetchNormalizedPrograms({ signal } = {}) {
    const result = await api("/programs/normalize", { signal });
    if (!Array.isArray(result) || result.some((program) => !program || typeof program !== "object")) {
        throw new Error("Invalid program management response.");
    }
    return result;
}

export async function FetchCollectionData({ signal, allPages = false } = {}) {
    const limit = allPages ? 50 : 12;
    const fetchPage = async (page) => {
        const response = await fetch(`${API_URL}/schools?page=${page}&limit=${limit}`, { signal });
        if (!response.ok) {
            throw new Error(`Unable to load universities (${response.status}).`);
        }
        return response.json();
    };

    const result = await fetchPage(1);
    // Use the total across all pages, rather than the current page's length.
    const total = result?.pagination?.total;
    const universityCount = Number(total);
    if (!Array.isArray(result?.data) ||
        !["number", "string"].includes(typeof total) ||
        String(total).trim() === "" ||
        !Number.isSafeInteger(universityCount) || universityCount < 0) {
        throw new Error("Invalid universities response.");
    }

    let universities = result.data;
    if (allPages) {
        const pageCount = Math.ceil(universityCount / limit);
        const remainingPages = await Promise.all(
            Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) => fetchPage(index + 2))
        );
        if (remainingPages.some((pageResult) => !Array.isArray(pageResult?.data))) {
            throw new Error("Invalid universities response.");
        }
        universities = [result.data, ...remainingPages.map((pageResult) => pageResult.data)].flat();
    }

    return { universities, universityCount, lastSyncAt: result.lastSyncAt ?? null };
}

export async function FetchPrograms({ signal } = {}) {
    const response = await fetch(`${API_URL}/programs`, { signal });
    if (!response.ok) {
        throw new Error(`Unable to load programs (${response.status}).`);
    }

    const result = await response.json();
    const total = result?.pagination?.total;
    const programCount = Number(total);
    if (!Array.isArray(result?.data) ||
        !["number", "string"].includes(typeof total) ||
        String(total).trim() === "" ||
        !Number.isSafeInteger(programCount) || programCount < 0) {
        throw new Error("Invalid programs response.");
    }

    return { programs: result.data, programCount, lastSyncAt: result.lastSyncAt ?? null };
}
