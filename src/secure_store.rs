use aes_gcm::aead::{Aead, KeyInit, OsRng};
use aes_gcm::{Aes256Gcm, Nonce};
use argon2::Argon2;
use rand_core::RngCore;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum SecureStoreError {
    #[error("encryption failed")]
    Encrypt,
    #[error("decryption failed")]
    Decrypt,
    #[error("key derivation failed: {0}")]
    KeyDerivation(String),
    #[error("serialization failed: {0}")]
    Serialization(String),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct EncryptedSecret {
    pub nonce: Vec<u8>,
    pub salt: Vec<u8>,
    pub ciphertext: Vec<u8>,
}

pub fn encrypt_secret(
    plaintext: &str,
    passphrase: &str,
) -> Result<EncryptedSecret, SecureStoreError> {
    let mut salt = vec![0u8; 16];
    OsRng.fill_bytes(&mut salt);
    let key = derive_key(passphrase, &salt)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|_| SecureStoreError::Encrypt)?;
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&nonce_bytes), plaintext.as_bytes())
        .map_err(|_| SecureStoreError::Encrypt)?;

    Ok(EncryptedSecret {
        nonce: nonce_bytes.to_vec(),
        salt,
        ciphertext,
    })
}

pub fn decrypt_secret(
    encrypted: &EncryptedSecret,
    passphrase: &str,
) -> Result<String, SecureStoreError> {
    let key = derive_key(passphrase, &encrypted.salt)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|_| SecureStoreError::Decrypt)?;
    let plaintext = cipher
        .decrypt(
            Nonce::from_slice(&encrypted.nonce),
            encrypted.ciphertext.as_ref(),
        )
        .map_err(|_| SecureStoreError::Decrypt)?;
    String::from_utf8(plaintext).map_err(|error| SecureStoreError::Serialization(error.to_string()))
}

fn derive_key(passphrase: &str, salt: &[u8]) -> Result<[u8; 32], SecureStoreError> {
    let mut key = [0u8; 32];
    Argon2::default()
        .hash_password_into(passphrase.as_bytes(), salt, &mut key)
        .map_err(|error| SecureStoreError::KeyDerivation(error.to_string()))?;
    Ok(key)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encrypts_and_decrypts_secret() {
        let encrypted = encrypt_secret("token-value", "workspace-passphrase").unwrap();
        let decrypted = decrypt_secret(&encrypted, "workspace-passphrase").unwrap();

        assert_eq!(decrypted, "token-value");
    }
}
