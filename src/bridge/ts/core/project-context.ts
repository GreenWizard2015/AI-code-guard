import type { LintRunStatistics, LintSourceRecord } from 'src/types';
import type { LintProjectContext } from 'src/protocols';

/** Responsibilities: _lint source records storage_, _statistics exposure projection_. **/
export class LintProjectContextStore implements LintProjectContext {
	private readonly records: ReadonlyMap<string, LintSourceRecord>;
	private readonly statistics_value: LintRunStatistics;

	/** Responsibilities: _source records initialization_, _statistics initialization_. **/
	public constructor(records: LintSourceRecord[], statistics: LintRunStatistics) {
		this.records = new Map(records.map(record => [record.absolute_path, record]));
		this.statistics_value = statistics;
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
		return { ...this.statistics_value, source_records: this.records.size };
	}
}
