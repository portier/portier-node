import { isIPv4 } from "net";
import { domainToASCII } from "url";

/**
 * Normalize an email address.
 *
 * This method is useful when comparing user input to an email address
 * returned in a Portier token. It is not necessary to call this before
 * `authenticate`, normalization is already part of the authentication
 * process.
 *
 * @param {string} email
 * @return {string} An empty string on invalid input
 */
export default (email: string): string => {
  const localEnd = email.indexOf("@");
  if (localEnd === -1) return "";

  const local = email.slice(0, localEnd).toLowerCase();
  if (local === "") return "";

  const host = domainToASCII(email.slice(localEnd + 1));
  if (host === "" || host[0] === "[" || isIPv4(host)) return "";

  return `${local}@${host}`;
};
