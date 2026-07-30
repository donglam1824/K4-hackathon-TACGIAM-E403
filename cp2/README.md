Quick-check prototype — Kiểm tra nhanh hiểu biết (Flow 4 bước)

Mục tiêu: Triển khai một prototype "Kiểm tra nhanh" ngay dưới câu trả lời của tutor — mô phỏng flow 4 bước theo spec: trigger → AI sinh câu hỏi → học viên trả lời bằng lời → AI chấm và trả 1 trong 3 trạng thái kèm trích dẫn.

Thư mục: `cp2/` chứa prototype (đã cập nhật giao diện để demo Quick-check).

Chạy locally:
1. Mở `cp2/index.html` bằng trình duyệt.
2. Chọn 1 trong 2 conversation demo (dropdown ở cột trái).
3. Nếu conversation có `citation`, nút "Kiểm tra nhanh" sẽ xuất hiện dưới câu trả lời của tutor.
4. Nhấn "Kiểm tra nhanh" → câu hỏi kiểm tra sẽ được sinh (mặc định là mô phỏng). Bạn có thể dán OpenAI API key vào ô để dùng AI thật.
5. Học viên nhập trả lời (1-2 câu) → bấm "Nộp trả lời" → hệ thống chấm và trả về 1 trong 3 trạng thái (Hiểu đúng / Chưa chắc / Không đủ căn cứ) kèm giải thích.

Ghi chú kỹ thuật:
- Mặc định prototype dùng phương pháp mô phỏng (fallback). Nếu bạn dán OpenAI API key (sk-...) vào ô, prototype sẽ gọi API Chat Completions để sinh câu hỏi và/hoặc chấm câu. (Bạn chịu trách nhiệm về key; gọi từ trình duyệt có thể lộ key.)
- Logs có thể được bật qua checkbox "Lưu log lần chạy (local)"; dữ liệu lưu trong localStorage và có thể tải về bằng nút "Tải logs (JSON)".

Non-goals (không build): chấm điểm chính thức, báo cáo tự động cho giảng viên, kiểm tra toàn bộ buổi học.

Nếu muốn: Tôi có thể
- Thêm 2 conversation thật lấy từ chatlog cụ thể bạn chỉ (ví dụ C0025 T0708) để demo.
- Thêm nút chụp 5 màn hình bằng script (node + puppeteer) và hướng dẫn chạy để tạo evidence.

Reply với: "Thêm logs" / "Kết nối OpenAI" / "Tạo evidence ảnh" để tôi làm tiếp.