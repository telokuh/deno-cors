FROM denoland/deno:latest
 
# Set dienjadi direktori root aplikasi kita.
WORKDIR /app

# Instal dependensi sistem: git, dan ca-certificates
RUN apt-get update && \
    apt-get install -y --no-install-recommends git ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Clone repositori sonto ke subdirektori sementara di dalam /app
RUN git clone https://github.com/cdnss/sonto /app/sonto_temp

# Pindahkan semua konten dari subdirektori sonto_temp ke direktori kerja /app
# Menggunakan cp -a untuk menyalin semua file dan direktori (termasuk yang tersembunyi seperti .git), sambil mempertahankan metadata
# Kemudian hapus subdirektori sementaranya
RUN cp -a /app/sonto_temp/. /app/ && rm -rf /app/sonto_temp

# Opsional: Hapus folder .git jika Anda tidak memerlukan history git di dalam container runtime
# Jika di repositori Anda ada file-file yang tidak dibutuhkan di runtime (misal: .gitignore, .github, dll),
# Anda bisa menambahkan perintah rm atau find/delete tambahan di sini setelah memindahkan konten.
RUN rm -rf /app/.git


# Cache dependensi Deno (opsional). Path script sekarang langsung di /app.
RUN deno cache /app/deno.ts 

# Expose port yang digunakan oleh server Deno Anda (sesuai dengan serve({ port: 8000 }))
EXPOSE 8080 

# Perintah default untuk menjalankan script Deno dari direktori kerja /app
CMD ["deno", "run", "-A", "/app/deno.ts"]
