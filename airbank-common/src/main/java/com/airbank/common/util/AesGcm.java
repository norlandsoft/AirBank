package com.airbank.common.util;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * AES-256-GCM：敏感字段（证件号/手机号）加密存储，密文格式 base64(iv || ciphertext)。
 */
public final class AesGcm {

    private static final SecureRandom RANDOM = new SecureRandom();

    private AesGcm() {
    }

    public static String encrypt(String plain, String key) {
        try {
            byte[] iv = new byte[12];
            RANDOM.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, keySpec(key), new GCMParameterSpec(128, iv));
            byte[] ct = cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            byte[] out = new byte[iv.length + ct.length];
            System.arraycopy(iv, 0, out, 0, iv.length);
            System.arraycopy(ct, 0, out, iv.length, ct.length);
            return Base64.getEncoder().encodeToString(out);
        } catch (Exception e) {
            throw new IllegalStateException("aes encrypt failed", e);
        }
    }

    public static String decrypt(String encoded, String key) {
        try {
            byte[] all = Base64.getDecoder().decode(encoded);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, keySpec(key), new GCMParameterSpec(128, all, 0, 12));
            byte[] pt = cipher.doFinal(all, 12, all.length - 12);
            return new String(pt, StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("aes decrypt failed", e);
        }
    }

    private static SecretKeySpec keySpec(String key) {
        byte[] k = key.getBytes(StandardCharsets.UTF_8);
        if (k.length < 32) {
            byte[] padded = new byte[32];
            System.arraycopy(k, 0, padded, 0, k.length);
            k = padded;
        }
        return new SecretKeySpec(k, 0, 32, "AES");
    }
}
