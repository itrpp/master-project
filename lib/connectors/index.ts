import type { ServiceConnectionResult, ServiceTargetId } from "@/types/connections";
import { testLdapConnection } from "./ldap-connector";
import { testMySQLTarget } from "./mysql-connector";
import { testOracleConnection } from "./oracle-connector";
import { testSmtpConnection } from "./smtp-connector";

export const ALL_SERVICE_TARGETS: ServiceTargetId[] = [
  "oracle",
  "mysql_main",
  "mysql_inventory",
  "mysql_gotowin",
  "ldap",
  "smtp",
];

export async function testSingleServiceConnection(
  target: ServiceTargetId,
): Promise<ServiceConnectionResult> {
  switch (target) {
    case "oracle":
      return testOracleConnection();
    case "mysql_main":
    case "mysql_inventory":
    case "mysql_gotowin":
      return testMySQLTarget(target);
    case "ldap":
      return testLdapConnection();
    case "smtp":
      return testSmtpConnection();
  }
}

export async function testAllServiceConnections(): Promise<ServiceConnectionResult[]> {
  return Promise.all(
    ALL_SERVICE_TARGETS.map((target) => testSingleServiceConnection(target)),
  );
}
