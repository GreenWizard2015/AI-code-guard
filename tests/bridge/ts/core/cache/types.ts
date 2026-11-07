/** Responsibilities: _cache publication fault contracts_, _nested writer callbacks_. **/
export enum CachePublicationFaultSchedule {
	WriteAfterTempCreated = "write-after-temp-created",
	WriteAfterTempCreatedWithPeer = "write-after-temp-created-with-peer",
	WriteAfterTempCreatedCleanupFails = "write-after-temp-created-cleanup-fails",
	RenameTemp = "rename-temp",
}

export type CallableCachePublicationScheduledWrite = () => void;

/** Responsibilities: _publication fault configuration_. **/
export type CachePublicationFaultConfiguration = {
	readonly schedule: CachePublicationFaultSchedule;
	readonly failure: Error;
};

/** Responsibilities: _publication fault test cases_. **/
export type CachePublicationFaultCase = {
	readonly title: string;
	readonly schedule: CachePublicationFaultSchedule;
};
