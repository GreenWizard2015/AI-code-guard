import type { LintRunStatistics, LintSourceRecord } from "src/types";
import type { LintProjectContextContract, ProjectSourceIOContract } from "src/protocols";

/** Responsibilities: _lint source records storage_, _statistics exposure projection_. **/
export class LintProjectContextStore implements LintProjectContextContract {
	private readonly records: ReadonlyMap<string, LintSourceRecord>;
	private readonly statistics_value: LintRunStatistics;
	public readonly source_io: ProjectSourceIOContract;

	/** Responsibilities: _source records initialization_, _statistics initialization_. **/
	public constructor(records: LintSourceRecord[], statistics: LintRunStatistics, source_io: ProjectSourceIOContract) {
		this.records = new Map(records.map((record) => [record.absolute_path, record]));
		this.statistics_value = statistics;
		this.source_io = source_io;
	}

	/** Responsibilities: _resolution source record path_. **/
	public source_record(file: string): LintSourceRecord {
		const record = this.records.get(file);
		if (!record) {
			throw new Error(`Lint source is not loaded: ${file}`);
		}
		return record;
	}

	/** Responsibilities: _output storage source records_. **/
	public files(): readonly LintSourceRecord[] {
		return [...this.records.values()];
	}

	/** Responsibilities: _output execution statistics current_. **/
	public statistics(): LintRunStatistics {
		const statistics = { ...this.statistics_value, source_records: this.records.size };
		if (statistics.source_reads < statistics.source_records) {
			throw new Error("Lint statistics report fewer source reads than source records.");
		}
		if (statistics.typescript_parses + statistics.python_parses > statistics.source_reads) {
			throw new Error("Lint statistics report more parses than source reads.");
		}
		return statistics;
	}
}
