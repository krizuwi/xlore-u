import { FetchCollectionData, FetchPrograms } from "./dashboardApiRequest.jsx";

export async function DataCollection({ signal } = {}) {
    const [universities, programs] = await Promise.all([
        FetchCollectionData({ signal }),
        FetchPrograms({ signal })
    ]);

    const syncTimes = [universities.lastSyncAt, programs.lastSyncAt]
        .filter(Boolean)
        .map((value) => Date.parse(value))
        .filter(Number.isFinite);

    return {
        ...universities,
        ...programs,
        lastSyncAt: syncTimes.length ? new Date(Math.max(...syncTimes)).toISOString() : null,
        totalRecords: universities.universityCount + programs.programCount,
        chartData: [
            { label: "Universities", records: universities.universityCount },
            { label: "Programs", records: programs.programCount }
        ]
    };
}

export default DataCollection;
