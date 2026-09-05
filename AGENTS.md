# Agent Kuralları

Bu dosya, projede çalışan yapay zeka ajanları için kalıcı çalışma kurallarını tanımlar.

## Handoff Zorunluluğu

- Kullanıcı, yapılan açıklamaların/işlemlerin/isteklerin dosyalanmasını istediğinde `AGENT_HANDOFF.md` dosyasını oluştur veya güncelle.
- Kodda, testte veya davranışta anlamlı bir değişiklik yapıldıysa işlem sonunda `AGENT_HANDOFF.md` güncel tutulmalıdır.
- Handoff notu en az şu başlıkları içermelidir:
  - Tarih
  - Kullanıcı isteği
  - Kök neden analizi (varsa)
  - Yapılan değişiklikler (dosya ve fonksiyon düzeyi)
  - Doğrulama adımları ve sonuçları
  - Sonraki agent için takip listesi
- Komut başarısızlıkları ve düzeltme adımları da not edilmelidir (ör. geçersiz CLI parametresi, ardından doğru komut).

## Uygulama Şekli

- Varsayılan handoff dosyası adı: `AGENT_HANDOFF.md`
- Aynı görevde tekrar işlem yapılıyorsa yeni dosya açmak yerine mevcut handoff güncellenir.
- Hassas veri (token, secret, kişisel veri) handoff dosyasına yazılmaz.
