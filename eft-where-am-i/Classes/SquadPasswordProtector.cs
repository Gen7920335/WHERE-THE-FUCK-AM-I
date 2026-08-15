using System.Security.Cryptography;
using System.Text;

namespace eft_where_am_i.Classes
{
    internal static class SquadPasswordProtector
    {
        private const string Prefix = "dpapi-current-user-v1:";
        private static readonly byte[] Entropy = Encoding.UTF8.GetBytes("WHERE THE FUCK AM I/squad-password/v1");

        public static string Protect(string password)
        {
            if (string.IsNullOrEmpty(password))
            {
                return string.Empty;
            }

            byte[] plaintext = Encoding.UTF8.GetBytes(password);
            try
            {
                byte[] ciphertext = ProtectedData.Protect(plaintext, Entropy, DataProtectionScope.CurrentUser);
                return Prefix + Convert.ToBase64String(ciphertext);
            }
            finally
            {
                CryptographicOperations.ZeroMemory(plaintext);
            }
        }

        public static string Unprotect(string protectedPassword)
        {
            if (string.IsNullOrWhiteSpace(protectedPassword) ||
                !protectedPassword.StartsWith(Prefix, StringComparison.Ordinal))
            {
                return string.Empty;
            }

            byte[]? ciphertext = null;
            byte[]? plaintext = null;
            try
            {
                ciphertext = Convert.FromBase64String(protectedPassword[Prefix.Length..]);
                plaintext = ProtectedData.Unprotect(ciphertext, Entropy, DataProtectionScope.CurrentUser);
                return Encoding.UTF8.GetString(plaintext);
            }
            catch (CryptographicException)
            {
                return string.Empty;
            }
            catch (FormatException)
            {
                return string.Empty;
            }
            finally
            {
                if (ciphertext != null)
                {
                    CryptographicOperations.ZeroMemory(ciphertext);
                }

                if (plaintext != null)
                {
                    CryptographicOperations.ZeroMemory(plaintext);
                }
            }
        }
    }
}
