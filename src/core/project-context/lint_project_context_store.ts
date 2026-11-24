import type { LintProjectContextContract } from "src/shared_services_protocols";
import type { ProjectSourceIOContract } from "src/source_protocols";
import type { LintSourceRecordData } from "src/source_types";
import type { LintRunStatistics } from "src/types";

/** Responsibilities: _lint source records storage_, _statistics exposure projection_. **/
export class LintProjectContextStore implements LintProjectContextContract {
	private readonly _records: ReadonlyMap<string, LintSourceRecordData>;
	private readonly _record_list: readonly LintSourceRecordData[];
	private readonly _statistics_value: LintRunStatistics;
	private readonly _source_io_value: ProjectSourceIOContract;

	/** Responsibilities: _source records initialization_, _statistics initialization_. **/
	public constructor(
		records: LintSourceRecordData[],
		statistics: LintRunStatistics,
		source_io: ProjectSourceIOContract,
	) {
		this._records = new Map(records.map((record) => [record.absolute_path, record]));
		this._record_list = Object.freeze([...this._records.values()]);
		this._statistics_value = statistics;
		this._source_io_value = source_io;
	}

	/** Responsibilities: _project source access_. **/
	public source_io(): ProjectSourceIOContract {
		return this._source_io_value;
	}

	/** Responsibilities: _resolution source record path_. **/
	public source_record(file: string): LintSourceRecordData {
		const record = this._records.get(file);
		if (!record) {
			throw new Error(`Lint source is not loaded: ${file}`);
		}
		return record;
	}

	/** Responsibilities: _output storage source records_. **/
	public files(): readonly LintSourceRecordData[] {
		return this._record_list;
	}

	/** Responsibilities: _output execution statistics current_. **/
	public statistics(): LintRunStatistics {
		const statistics = { ...this._statistics_value, source_records: this._records.size };
		if (statistics.source_reads < statistics.source_records) {
			throw new Error("Lint statistics report fewer source reads than source records.");
		}
		if (statistics.typescript_parses + statistics.python_parses > statistics.source_reads) {
			throw new Error("Lint statistics report more parses than source reads.");
		}
		return statistics;
	}
}
