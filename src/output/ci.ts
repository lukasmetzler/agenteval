export interface CIReportTask {
	task: string;
	score: number;
	previousScore: number | null;
	delta: number | null;
	status: "pass" | "fail";
	reason: string;
	runStatus: "success" | "error" | "timeout";
}

export function formatCIJson(tasks: CIReportTask[], elapsedSeconds: number): string {
	const failed = tasks.filter((t) => t.status === "fail").length;
	return JSON.stringify(
		{
			passed: failed === 0,
			summary: { tasks: tasks.length, passed: tasks.length - failed, failed, elapsedSeconds },
			tasks,
		},
		null,
		2,
	);
}

function xmlEscape(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

/** JUnit XML, the common denominator for CI test report widgets. */
export function formatCIJunit(tasks: CIReportTask[], elapsedSeconds: number): string {
	const failures = tasks.filter((t) => t.status === "fail" && t.runStatus === "success").length;
	const errors = tasks.filter((t) => t.status === "fail" && t.runStatus !== "success").length;
	const cases = tasks.map((t) => {
		const name = xmlEscape(t.task);
		const props = `score=${t.score.toFixed(2)}${t.previousScore !== null ? ` previous=${t.previousScore.toFixed(2)}` : ""}`;
		if (t.status === "pass") {
			return `    <testcase classname="agenteval" name="${name}"><system-out>${props}</system-out></testcase>`;
		}
		const tag = t.runStatus === "success" ? "failure" : "error";
		return `    <testcase classname="agenteval" name="${name}"><${tag} message="${xmlEscape(t.reason)}">${props}</${tag}></testcase>`;
	});
	return [
		'<?xml version="1.0" encoding="UTF-8"?>',
		`<testsuites name="agenteval ci" tests="${tasks.length}" failures="${failures}" errors="${errors}" time="${elapsedSeconds}">`,
		`  <testsuite name="agenteval ci" tests="${tasks.length}" failures="${failures}" errors="${errors}" time="${elapsedSeconds}">`,
		...cases,
		"  </testsuite>",
		"</testsuites>",
	].join("\n");
}
