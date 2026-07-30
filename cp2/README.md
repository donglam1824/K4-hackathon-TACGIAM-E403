Quick-check prototype — Kiểm tra nhanh hiểu biết (Flow 4 bước, theo `03-ai-spec.md` §4)

Mục tiêu: Triển khai một prototype "Kiểm tra nhanh" ngay dưới câu trả lời của tutor — mô phỏng flow 4 bước theo spec: trigger → AI sinh câu hỏi → học viên trả lời bằng lời → AI chấm và trả 1 trong 3 trạng thái kèm trích dẫn, cộng đường riêng cho lớp ③ (ngoài phạm vi).

Thư mục: `cp2/` chứa prototype mức **Mock** (đúng lựa chọn ở spec §4): UI + data hội thoại là mock (dán cứng nguyên văn từ chatlog thật), lõi sinh câu hỏi + chấm là AI call thật khi có API key — hỗ trợ cả **Gemini** (Google AI Studio free tier, khuyến nghị theo `02-guide.md` §3.4) và OpenAI, tự nhận diện theo định dạng key. Không có key thì dùng fallback mô phỏng, mock test được ngay không cần mạng.

## Chạy với Gemini thật (khuyến nghị)

1. Lấy API key miễn phí tại [Google AI Studio](https://aistudio.google.com/apikey).
2. Copy `cp2/.env.example` thành `cp2/.env`, dán key vào `GEMINI_API_KEY=` (file `.env` đã bị `.gitignore` chặn — không bao giờ commit).
3. Chạy `node cp2/serve.js` (không cần cài thêm package), rồi mở `http://localhost:8787`.
4. Trang tự nạp key từ `.env` — **không có ô nào trên web để dán/nhập key**, dòng trạng thái nhỏ ở panel giữa sẽ báo "🔑 Đã nạp Gemini key từ .env" khi thành công. Muốn đổi key thì sửa trong file `.env` rồi tải lại trang.

Nếu mở thẳng `cp2/index.html` bằng trình duyệt (không qua `node serve.js`), trang sẽ không đọc được `.env` — dòng trạng thái báo "⚪ Không có key" và tự chuyển sang chế độ mô phỏng.

## Chạy locally (không cần AI thật)

1. Mở `cp2/index.html` bằng trình duyệt (hoặc qua `serve.js` như trên).
2. Chọn 1 trong 3 conversation demo (dropdown cột trái) — cả 3 đều là turn thật từ `data/vlearn-pack/chatlog/`:
   - **Case 1** (C0025 T0708, `citations=[35]`) — happy path, chủ đề Multi-head attention.
   - **Case 2** (C0096 T0558, `citations=[13]`) — happy path, chủ đề 5 Trụ cột Responsible AI.
   - **Case 3** (C0220 T0939, `citations=[]`) — **lớp ①**: không có căn cứ, nút "Kiểm tra nhanh" tự ẩn và hiện thông báo lý do thay vì im lặng biến mất.
3. Với case 1/2: nhấn "Kiểm tra nhanh" → câu hỏi kiểm tra được sinh (mô phỏng nếu không có API key, gọi Gemini/OpenAI thật nếu có key).
4. Nhập câu trả lời rồi bấm "Nộp trả lời" — hoặc dùng **nút preset** để mock test nhanh từng lớp chỗ khó mà không cần gõ tay:

   | Nút preset | Mô phỏng lớp | Kỳ vọng theo spec §5/§6 |
   |---|---|---|
   | ✅ Hiểu đúng | happy path | Badge xanh, giải thích ngắn vì sao đúng |
   | ② Mơ hồ | lớp ② | Badge vàng "Chưa chắc" — không kết luận đạt |
   | ③ Đòi điểm | lớp ③ | Badge tím "🚫 Ngoài phạm vi" — **không đưa vào chấm 3 trạng thái**, từ chối đúng phạm vi rồi dẫn quay lại (kiểm tra bằng `detectOutOfScope()` trước khi gọi AI chấm) |
   | ④ Sai bản chất | lớp ④ | Trả lời đúng từ khoá ("nhiều model chạy song song") nhưng sai bản chất so với ref (thực ra là nhiều *head* trong *cùng 1* model) |

   **Lưu ý khi demo lớp ④ ở chế độ fallback (không có API key)**: heuristic so khớp từ khoá đơn giản **có thể chấm nhầm "Hiểu đúng"** vì câu trả lời sai vẫn trùng nhiều từ với ref (`multi-head`, `song song`, `model`...). Đây **không phải bug cần sửa** — nó minh hoạ đúng rủi ro đã ghi trong spec §5 ("Phải bắt được bằng đối chiếu ý nghĩa chứ không chỉ so khớp từ khoá — đây là failure nguy hiểm nhất nếu bỏ sót"). Muốn thấy AI chấm đúng ý nghĩa, chạy qua `node serve.js` với key thật trong `.env` rồi thử lại case này.

5. Case 3 (lớp ①): chọn xong sẽ thấy khối đỏ giải thích lý do, không có nút "Kiểm tra nhanh" — đúng hành vi mong muốn (không tự bịa câu hỏi khi thiếu căn cứ).

## Ghi chú kỹ thuật

- Mặc định prototype dùng phương pháp mô phỏng (fallback). Nếu `.env` có key hợp lệ (chạy qua `serve.js`), `callLLM()` trong `app.js` tự nhận diện: key bắt đầu bằng `sk-` → gọi OpenAI Chat Completions; ngược lại (vd `AIza...`) → gọi Gemini `generateContent`. Không có ô nhập key trên UI — key chỉ đến từ `.env`, tránh gõ nhầm/dán lộ key khi demo trước lớp. (Gọi trực tiếp từ trình duyệt vẫn có thể thấy key qua Network tab của DevTools — chỉ dùng để demo cục bộ, không deploy public.)
- Key trong `.env` chỉ dùng cho local qua `serve.js` — không commit `.env` (đã có trong `.gitignore` gốc), chỉ commit `.env.example` (không chứa key thật).
- Chỉ dùng data đã mock từ chatlog data pack — không đưa data pack gốc lên nơi khác, tuân luật an toàn ở `02-guide.md` §3.4.
- Logs có thể bật qua checkbox "Lưu log lần chạy (local)"; dữ liệu lưu trong `localStorage`, tải về bằng nút "Tải logs (JSON)" — dùng để làm evidence cho `eval/` khi chạy golden set thật.

## Đối chiếu với spec

- **Lát cắt MỘT CÂU** (§4): đã bám đúng — 1 học viên · 1 câu hỏi kiểm tra bám đúng đoạn vừa trao đổi · AI quyết định hiểu-đúng-hay-không · trả về xác nhận/chỉ đoạn cần đọc lại.
- **Bốn đường đi trải nghiệm** (§6): happy path (preset "Hiểu đúng"), low-confidence (preset "Mơ hồ"), failure/không căn cứ (case 3), ngoài phạm vi (preset "Đòi điểm"), đặc thù domain (preset "Sai bản chất") — đều test được trực tiếp trên UI này, chỉ thiếu "correction" (học viên sửa câu trả lời) — thử bằng cách nộp preset ② hoặc ④ rồi sửa lại `studentAnswer` và nộp lần 2 trong cùng phiên.
- **Non-goals** (§4): không có nút chấm điểm chính thức, không gửi báo cáo giảng viên, chỉ kiểm tra 1 turn gần nhất — đúng như thiết kế.

## Việc còn lại (không tự làm hộ được — xem `03-ai-spec.md` §7)

- Chạy 20 case trong golden set (spec §7) qua chính app này (dùng preset + demo cases làm nền, bổ sung case còn thiếu), ghi kết quả % thật vào `eval/`.
- Test độ rõ bằng người thứ hai: 2 thành viên chấm độc lập cùng 5 output đầu, so lệch.
