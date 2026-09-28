/** Responsibilities: _define test path checking_. **/
export interface TestPathChecker {
	directory(path: string): boolean;
}
