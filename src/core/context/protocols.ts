/** Responsibilities: _define test path checking_. **/
export interface TestPathCheckerContract {
	directory(path: string): boolean;
	file(path: string): boolean;
}
