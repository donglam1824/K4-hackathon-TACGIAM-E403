# AI SPEC — Kiểm tra hiểu thật cuối buổi · Nhóm [TACGIAM] · Zone [A2]
Hướng: [x] A — VLearn  [ ] B — Trợ lý Học viên  [ ] C — Làn mở
Loại: [ ] Tối ưu tính năng có sẵn  [x] Tính năng mới

## §1. User & Job
- **Job executor**: Học viên đang trong một buổi học VLearn (`conversation_mode = in_class`), vừa hỏi tutor ít nhất 1 câu về nội dung tài liệu buổi học.
- **Core JTBD** *(không tên sản phẩm/AI)*: Xác nhận mình đã thực sự hiểu đúng phần vừa học, trước khi rời buổi hoặc chuyển sang phần khác.
- **Job story**:
  - Khi em vừa được tutor giải thích một khái niệm mới xong, em muốn biết mình đã hiểu đúng hay chưa, để em có thể yên tâm chuyển sang phần tiếp theo mà không mang theo hiểu sai.
  - Khi em đọc xong một đoạn trả lời dài của tutor, em muốn được hỏi lại bằng một câu ngắn dễ trả lời, để em tự kiểm tra thay vì tự nhận là "đã hiểu" một cách chủ quan.
  - Khi buổi học sắp kết thúc, em muốn có một bước chốt lại xem mình còn hổng chỗ nào, để em biết cần ôn lại phần nào trước khi qua bài mới.
- **Problem statement** *(KHÔNG chữ AI)*: Học viên hỏi xong một câu trong buổi học là rời đi luôn, không có bước nào xác nhận lại họ hiểu đúng — trả lời đúng của tutor không đồng nghĩa với việc học viên tiếp thu đúng, và không ai phát hiện ra chỗ hiểu sai cho tới khi làm quiz/bài thi.
- **Evidence** (đường B — mining, log tại `data/vlearn-pack/chatlog/`):
  - Số liệu mining (n = 1.261 turn tutor, 585 hội thoại, 22/07–29/07/2026):
    - `asked_check_question = True`: **3/1.261 turn (0,24%)** — tutor gần như không bao giờ chủ động hỏi lại để kiểm tra hiểu.
    - `move_used = validate_understanding`: **1/1.261 turn tutor (0,08%)**.
    - **309/585 hội thoại (52,8%)** chỉ có đúng 1 turn (student hỏi → tutor trả lời) rồi kết thúc, không quay lại kiểm tra.
    - `misconceptions` (field để ghi hiểu lầm phát hiện được): **0/1.261 turn có giá trị** — chưa từng được dùng dù có sẵn chỗ ghi.
    - `citations = []` (tutor trả lời không grounding vào tài liệu): **46,2% turn** — liên quan trực tiếp tới lớp chỗ khó ① (nếu không có căn cứ, feature kiểm tra không được tự bịa câu hỏi).
    - Phương pháp đếm: lọc toàn bộ 1.261 dòng `role=tutor` theo cột `asked_check_question`, `move_used`, `citations`; nhóm 2.522 dòng theo `conversation_id` (585 hội thoại) để đếm số message/hội thoại. Script đếm dùng `csv.DictReader` + `collections.Counter`, chạy lại được trên file gốc.
  - Quote/ví dụ nguyên văn *(≥5, mã hội thoại/turn để đối chiếu — không dán nguyên văn dài, chỉ trích đủ minh hoạ)*:
    1. Một trong 3 lần hiếm hoi tutor chủ động hỏi lại (C0063, T0849): *"...tôi đã soạn một câu hỏi ngắn dưới đây: Câu hỏi: Trong ngữ cảnh của bài học, sự khác biệt căn bản nhất về cách thức hoạt động giữa một Chatbot thông thường và một..."*
    2. Hội thoại 1-turn điển hình — hỏi xong không quay lại (C0096, T0558): học viên bôi đen "Trụ Cột Responsible AI" trang 13, hỏi *"Giải thích đoạn bôi đen ở Trang 13."* → tutor trả lời đầy đủ, hội thoại kết thúc ngay sau đó, không có bước xác nhận hiểu.
    3. Hội thoại 1-turn khác (C0025, T0708): học viên hỏi về "Multi-head" trang 35 → tutor giải thích cơ chế attention, hội thoại dừng lại, không kiểm tra học viên có nắm được khái niệm hay chỉ đọc lướt.
    4. Hội thoại 1-turn (C0220, T0939): học viên hỏi *"con agent nó sẽ làm gì"* dựa trên ví dụ vé máy bay → tutor trả lời quy trình ReAct đầy đủ nhưng `citations=[]` (không grounding) — vừa minh hoạ pattern "hỏi xong rời đi" vừa minh hoạ rủi ro lớp ① nếu dùng turn này làm nguồn sinh câu hỏi kiểm tra.
    5. Hội thoại 1-turn (C0373, T0891): học viên hỏi phân biệt chatbot và agent → tutor giải thích rõ, hội thoại kết thúc, không có bước nào xác nhận học viên phân biệt được thật hay chỉ đọc xong đoạn văn.
  - **[TODO — nhóm bổ sung Đường A]**: khảo sát ≥20 người ngoài nhóm, ≥50% xác nhận, log câu hỏi + từng câu trả lời nguyên văn. Gợi ý câu hỏi (theo nguyên tắc "hỏi lần gần nhất", không hỏi ý kiến): *"Lần gần nhất bạn hỏi tutor VLearn xong, bạn làm gì tiếp — đọc lại, làm quiz, hay chuyển bài luôn? Lúc đó bạn có chắc mình hiểu đúng không?"*

## §2. Impact & quyết định chọn
- **Bảng impact (3 ứng viên)**:

| Ứng viên | Bao nhiêu người gặp | Tần suất | Mỗi lần tốn gì | Build nổi không |
|---|---|---|---|---|
| Kiểm tra hiểu thật cuối buổi | ≥52,8% hội thoại (309/585) kết thúc không kiểm tra | Mỗi buổi học có hỏi tutor | Hiểu sai mang qua bài sau, mất điểm quiz | Có — 1 AI call sinh câu hỏi + chấm câu trả lời |
| Trải nghiệm học online (điều hướng tài liệu) | Chưa đo được từ data pack hiện có | Không rõ | Không rõ | Khó định lượng trong thời gian sự kiện |
| Bản đồ lỗ hổng lớp cho giảng viên | Gián tiếp — cần tổng hợp nhiều học viên/buổi | Theo buổi | Giảng viên dạy sai trọng tâm | Cần nhiều dữ liệu hơn 1 lớp mới có ý nghĩa thống kê |

- **Ứng viên ĐÃ LOẠI + vì sao**:
  - Trải nghiệm học online: thiếu bằng chứng đếm được từ data pack hiện có — không tự tin sẽ tìm đủ evidence trong thời gian sự kiện.
  - Bản đồ lỗ hổng lớp: object là giảng viên chứ không phải học viên trực tiếp trong lát cắt "một người dùng"; cần aggregate nhiều buổi/nhiều học viên mới ra tín hiệu đáng tin, khó build và đo trong 1 sự kiện.
- **Ứng viên CHỌN + vì sao (bằng số)**: Kiểm tra hiểu thật cuối buổi — bằng chứng B mạnh nhất hiện có (0,24% / 0,08% / 52,8% từ 585 hội thoại thật) và ảnh hưởng >50% số hội thoại trong data pack, có thể build 1 AI call (sinh câu hỏi + chấm) trong thời gian sự kiện.

## §3. Giải pháp tương tự đã nghiên cứu
*(Bản nháp từ hiểu biết chung — mỗi thành viên vẫn cần tự dùng thử 15'/sản phẩm theo guide §2.2 để có quan sát cụ thể thật, thay cho phần suy đoán dưới đây trước khi nộp.)*

- **Khanmigo (Khan Academy)**: flow — sau khi giải thích một khái niệm, AI chủ động hỏi lại kiểu Socratic ("bạn thử giải thích lại bằng lời của mình xem") thay vì chấm đúng/sai thẳng. Đáng học: không tiết lộ đáp án ngay, để học viên tự diễn giải trước. Đáng né: đôi khi hỏi vòng vo quá nhiều bước khiến học viên mất kiên nhẫn. Mình khác: chỉ hỏi đúng 1 câu ngắn ngay sau turn, không kéo dài thành hội thoại Socratic nhiều vòng.
- **NotebookLM**: flow — luôn cite nguồn ngay cạnh câu trả lời để người dùng tự kiểm. Đáng học: gắn số trang/đoạn cụ thể vào mọi khẳng định (giống G11). Đáng né: NotebookLM không chủ động kiểm tra hiểu, chỉ hỗ trợ tra cứu — đây chính là khoảng trống mình lấp vào.
- **Duolingo**: flow — có bước "short check" ngay sau mỗi phần học, chấm nhanh và cho làm lại nếu sai. Đáng học: check ngắn, phản hồi tức thì, sửa dễ dàng (G9). Đáng né: câu hỏi dạng trắc nghiệm dễ đoán mò, không phản ánh hiểu sâu — mình chọn câu hỏi mở/diễn giải lại thay vì trắc nghiệm để giảm rủi ro đoán mò.
- **ChatGPT Study Mode**: flow — chủ động không đưa đáp án trực tiếp, dẫn dắt học viên tự suy luận. Đáng học: đặt câu hỏi bám sát ngữ cảnh vừa trao đổi. Đáng né: đôi khi từ chối trả lời thẳng ngay cả khi học viên chỉ muốn xác nhận nhanh — mình cân bằng bằng cách vẫn xác nhận rõ ràng "đúng/chưa chắc" thay vì chỉ hỏi ngược liên tục.

## §4. Thiết kế

### Giải pháp sơ bộ
**Bối cảnh xuất hiện**: ngay sau khi tutor trả lời xong 1 câu hỏi của học viên trong buổi học (turn vừa hoàn tất, có `citations` không rỗng).

**Flow 4 bước**:
1. **Trigger** — dưới câu trả lời của tutor, hiện khối nhỏ *"Kiểm tra nhanh xem bạn hiểu đúng chưa?"* (không ép buộc, học viên bỏ qua được — G8).
2. **AI sinh 1 câu hỏi kiểm tra ngắn** — bám đúng đoạn tài liệu vừa dùng để trả lời (dùng lại `citations`/đoạn gốc của turn đó làm ngữ cảnh), dạng câu hỏi mở/yêu cầu diễn giải lại — không phải trắc nghiệm đoán mò.
3. **Học viên trả lời bằng lời của mình** (1-2 câu).
4. **AI ra quyết định trung tâm** — đối chiếu câu trả lời với đoạn tài liệu gốc, trả về 1 trong 3 trạng thái:
   - ✅ Hiểu đúng — xác nhận ngắn + 1 câu giải thích vì sao đúng (G11).
   - ⚠️ Chưa chắc/mơ hồ — không kết luận đạt/chưa đạt, hỏi lại 1 câu làm rõ hoặc trỏ đúng đoạn tài liệu (kèm số trang) để học viên tự đối chiếu (G10).
   - ❌ Không đủ căn cứ — nếu turn gốc `citations=[]`, không sinh câu hỏi, báo thẳng "chưa đủ căn cứ để kiểm tra phần này" thay vì bịa (chặn lớp ①).

**Prototype tối thiểu để demo (5 phút)**: 1 màn hình mô phỏng đoạn hội thoại tutor–học viên có sẵn (lấy từ chatlog thật, ví dụ C0025 T0708 hoặc C0096 T0558) → bấm "Kiểm tra nhanh" → AI sinh câu hỏi (1 lời gọi AI thật) → nhập câu trả lời mẫu → AI chấm, trả 1 trong 3 trạng thái, có trích dẫn trang. Demo tối thiểu 2 case: 1 happy path + 1 case chỗ khó (gợi ý: lớp ④ — trả lời đúng từ khoá nhưng sai bản chất, xem §5).

- **Lát cắt MỘT CÂU** *(một người dùng · một công việc · một quyết định AI · một kết quả)*:
  Một học viên vừa nhận câu trả lời của tutor về một khái niệm trong buổi học · trả lời một câu hỏi kiểm tra ngắn bám đúng đoạn vừa trao đổi · AI quyết định câu trả lời đó có đủ căn cứ cho thấy học viên hiểu đúng hay không · trả về xác nhận hiểu đúng kèm lý do, hoặc chỉ thẳng đoạn tài liệu (kèm số trang) cần đọc lại.
- **Non-goals** *(≥3 thứ KHÔNG build)*:
  1. Không chấm điểm chính thức / không tính vào điểm số khoá học.
  2. Không tự tổng hợp báo cáo hiểu-lệch gửi giảng viên (đó là hướng "bản đồ lỗ hổng lớp" đã bị loại).
  3. Không kiểm tra toàn bộ buổi học — chỉ kiểm tra dựa trên đoạn tài liệu vừa trao đổi trong turn gần nhất.
- **Mức prototype nhắm tới**: [ ] Sketch [X] Mock [ ] Working — [TODO — nhóm chọn theo sức]. Phần nào mock/phần nào thật: [TODO — gợi ý: UI có thể Mock (data hội thoại giả lập từ chatlog thật), lõi sinh câu hỏi + chấm phải là AI call thật].
- **Automation**: [ ] augment [x] conditional [ ] automate.
  - Lý do (cost-of-error): AI tự sinh câu hỏi kiểm tra + tự chấm sơ bộ khi câu trả lời của học viên rõ ràng đối chiếu được với đoạn tài liệu gốc. Nhưng khi câu trả lời mơ hồ, AI **không tự kết luận "hiểu đúng"** — vì báo sai theo hướng này (nói hiểu đúng trong khi hiểu sai) khiến học viên mang kiến thức sai đi thi mà không tự phát hiện được, sửa đắt. Ngược lại báo "chưa chắc, đọc lại đoạn X" khi học viên thực ra đã hiểu đúng chỉ tốn thêm ít giây đọc lại — sai theo hướng này rẻ hơn nhiều, nên thiên về thận trọng khi không chắc.
- **§4b. Nguyên tắc đã áp dụng** *(≥4)*:

| Nguyên tắc | Áp cụ thể vào đâu trong prototype |
|---|---|
| G2 — Làm rõ nó làm tốt đến đâu | Câu hỏi kiểm tra luôn kèm dòng "dựa trên đoạn bạn vừa đọc, trang N" — học viên biết phạm vi câu hỏi |
| G10 — Thu hẹp phạm vi khi nghi ngờ *(bắt buộc)* | Câu trả lời học viên mơ hồ → không chấm "đạt/chưa đạt", hỏi lại 1 câu hoặc trỏ về đoạn tài liệu |
| G9 — Sửa dễ dàng | Học viên trả lời sai → cho trả lời lại ngay trong cùng khung, không phải hỏi lại tutor từ đầu |
| G11 — Giải thích vì sao | Khi chấm "chưa đúng", nói rõ chỗ lệch so với đoạn tài liệu gốc, không chỉ báo "sai" |
| G8 — Gạt bỏ dễ dàng | Khối "Kiểm tra nhanh" là tuỳ chọn, học viên bỏ qua được, không chặn flow đọc tiếp |

## §5. Kiểu lỗi — 4 lớp chỗ khó + kịch bản (≥8)

| Tình huống cụ thể | Lớp | Hành vi mong muốn | Nguyên tắc áp |
|---|---|---|---|
| Turn có `citations=[]` (46,2% turn hiện tại không grounding — ví dụ C0220 T0939) — không có đoạn tài liệu rõ ràng để dựa vào | ① Nguồn sự thật | Không sinh câu hỏi kiểm tra; báo "chưa đủ căn cứ để kiểm tra phần này" | G10 |
| AI bịa đáp án tham chiếu không khớp đoạn tài liệu thật | ① Nguồn sự thật | Đáp án tham chiếu phải trace được về đúng trang/đoạn của turn đó | G11 |
| Học viên trả lời nửa đúng nửa sai | ② Mơ hồ | Không chấm "đạt" — hỏi lại 1 câu cụ thể hơn hoặc yêu cầu giải thích thêm | G10 |
| Học viên trả lời cụt kiểu "ừ hiểu rồi" không giải thích gì | ② Mơ hồ | Không nhận acknowledgement suông là "đạt" — yêu cầu diễn giải lại bằng lời của học viên | G10 |
| Học viên dùng ô trả lời để hỏi tiếp câu khác (không trả lời câu kiểm tra) | ③ Ngoài phạm vi | Nhận diện đây không phải câu trả lời, dẫn học viên quay lại trả lời hoặc chuyển tutor xử lý câu hỏi mới | G1 |
| Học viên đòi AI "chấm điểm chính thức" / tính vào điểm khoá học | ③ Ngoài phạm vi | Từ chối, nhắc rõ đây là tự-kiểm-tra không tính điểm (khớp Non-goal §4) | G1 |
| Học viên trả lời đúng thuật ngữ nhưng sai bản chất (ví dụ nói "Multi-head là nhiều model chạy song song" thay vì nhiều "đầu chú ý" trong cùng 1 model — misconception thật, gốc từ C0025) | ④ Đặc thù domain | Phải bắt được bằng đối chiếu ý nghĩa chứ không chỉ so khớp từ khoá — đây là failure nguy hiểm nhất nếu bỏ sót | G11 |
| Học viên nhầm lẫn 2 khái niệm gần giống (Agent vs Chatbot, gốc từ C0373) khi diễn giải lại | ④ Đặc thù domain | Câu hỏi kiểm tra nên nhắm đúng điểm dễ nhầm, không hỏi chung chung | G2 |

*(≥2 case/lớp đã đủ theo yêu cầu tối thiểu. Tự kiểm: kịch bản làm nhóm sợ nhất khi demo — lớp ④, dòng "trả lời đúng thuật ngữ nhưng sai bản chất", vì đây là lỗi khó phát hiện nhất bằng so khớp từ khoá đơn giản. [TODO] chạy HAX Playbook để tìm thêm case hiểm nếu có thời gian.)*

## §6. Bốn đường đi của trải nghiệm
- **Happy path**: Học viên trả lời đúng, rõ ràng → AI xác nhận hiểu đúng, kèm 1 câu giải thích ngắn vì sao đúng (G11).
- **Low-confidence (②)**: Câu trả lời mơ hồ/nửa đúng → AI hỏi lại 1 câu làm rõ, không kết luận.
- **Failure/không căn cứ (①)**: Turn gốc không có đoạn tài liệu rõ ràng (`citations=[]`) → AI báo không đủ căn cứ để kiểm tra, không tự bịa câu hỏi/đáp án.
- **Correction (user sửa)**: Học viên trả lời sai → được trả lời lại ngay trong cùng khung (G9), không cần hỏi tutor lại từ đầu.
- **Khi bị đòi ngoài phạm vi (③)**: Học viên đòi chấm điểm chính thức hoặc hỏi lạc đề trong ô trả lời → từ chối phạm vi, dẫn về đúng luồng.
- **Case đặc thù domain (④)**: Học viên trả lời đúng từ khoá nhưng sai bản chất → AI phải phát hiện qua đối chiếu ý nghĩa, không chỉ khớp từ khoá.

## §7. Kiểm thử
- **Chiều chất lượng + định nghĩa kiểm chứng được**:
  - **Đúng-có-căn-cứ**: câu hỏi/đáp án tham chiếu trace được về đúng đoạn tài liệu của turn gốc — pass/fail.
  - **Chấm đúng**: kết quả chấm (đạt/chưa đạt/hỏi lại) khớp với đánh giá của người chấm tay đối chiếu transcript — pass/fail.
  - **Không kết luận liều**: khi input thuộc lớp ①/② mà AI vẫn chấm "đạt" dứt khoát → fail cứng, không có thang điểm — vi phạm là loại ngay.
  - *(Test độ rõ bằng người thứ hai — [TODO]: 2 thành viên chấm độc lập cùng 5 output đầu, so lệch, nếu lệch thì viết lại định nghĩa.)*

- **Golden set draft (20 case)** — nguồn thật từ chatlog ghi kèm `conversation_id`/`turn_id` để đối chiếu; case tổng hợp đánh dấu "synthetic". File thực tế lưu trong `eval/`, mở rộng lên 30+ nếu dùng promptfoo.

| # | Nguồn | Input tóm tắt | Lớp | Loại | Kỳ vọng |
|---|---|---|---|---|---|
| 1 | C0220 T0939 (thật) | Turn `citations=[]` về quy trình ReAct agent | ① | thường | AI không sinh câu hỏi, báo thiếu căn cứ |
| 2 | C0127 T1027 (thật) | Turn tutor đã từ chối vì không có nội dung slide 21-32 | ① | thường | AI không sinh câu hỏi kiểm tra cho turn này |
| 3 | Synthetic (dựa văn phong thật) | Học viên trả lời "ờ hiểu rồi" không giải thích | ② | thường | Không chấm đạt, yêu cầu diễn giải lại |
| 4 | Synthetic (dựa C0025) | Học viên trả lời nửa đúng về multi-head attention | ② | thường | Hỏi lại làm rõ, không kết luận |
| 5 | Synthetic | Học viên gõ "chấm điểm em đi, có tính điểm không" | ③ | thường | Từ chối, nhắc rõ đây là tự-kiểm-tra không tính điểm |
| 6 | Synthetic | Học viên hỏi lạc đề "vậy RAG là gì" trong ô trả lời check | ③ | thường | Nhận diện không phải câu trả lời, dẫn quay lại |
| 7 | Synthetic (dựa C0025) | Học viên nói "Multi-head là nhiều model chạy song song" (sai bản chất, đúng từ khoá) | ④ | hiếm | Phải bắt được bằng đối chiếu ý nghĩa, không chỉ khớp từ |
| 8 | Synthetic (dựa C0373) | Học viên lẫn lộn định nghĩa Agent và Chatbot khi diễn giải | ④ | hiếm | Câu hỏi/chấm điểm phải nhắm đúng điểm dễ nhầm |
| 9 | C0088 T0351 (thật) | Turn `citations=[12]` về JTBD "thấu hiểu vấn đề trước khi đề xuất giải pháp" | happy path | thường | Sinh câu hỏi đúng trang 12, chấm đúng khi học viên trả lời đúng |
| 10 | C0467 T0184 (thật) | Turn `citations=[28,29]` về "Quick Problem Card" | happy path | thường | Câu hỏi bám 2 trang nguồn, không lệch nội dung |
| 11 | C0070 T1050 (thật) | Turn `citations` nhiều trang (12,27,36,52,65,69) — tổng hợp nhiều nguồn | happy path | hiếm | AI chọn đúng phần liên quan, không trộn lẫn nội dung nhiều trang không liên quan |
| 12 | C0504 T0608 (thật) | Turn `citations=[11]` về đối tượng phục vụ AI trong lớp học quy mô lớn | happy path | thường | Câu hỏi kiểm tra bám đúng khái niệm "đối tượng phục vụ" |
| 13 | C0202 T0660 (thật) | Turn `citations=[11,25,27]` về "System prompt" | happy path | thường | Chấm đúng khi học viên phân biệt được system prompt vs instruction |
| 14 | C0096 T0558 (thật) | Turn `citations=[13]` về "Trụ Cột Responsible AI" (5 trụ cột) | happy path | thường | Câu hỏi yêu cầu liệt kê/diễn giải, chấm đúng khi đủ ý chính |
| 15 | C0025 T0708 (thật) | Turn `citations=[35]` về Multi-head attention | happy path | thường | Câu hỏi bám đúng cơ chế "nhiều đầu chú ý song song" |
| 16 | C0373 T0891 (thật) | Turn `citations=[2]` phân biệt chatbot và agent | happy path | thường | Câu hỏi kiểm tra đúng điểm phân biệt then chốt |
| 17 | Synthetic | Học viên trả lời bằng giọng địa phương/viết tắt ("cái chi dợ", "k hiểu lắm") | ② | hiếm | Không đánh giá nhầm là "không trả lời" — vẫn xử lý được, hỏi lại nếu chưa rõ |
| 18 | Synthetic | Học viên trả lời quá ngắn/không liên quan ("hii", "ok") thay vì trả lời câu hỏi kiểm tra | ③ | hiếm | Không chấm đạt, nhận diện đây không phải câu trả lời hợp lệ |
| 19 | Synthetic | Hội thoại dài (gốc cảm hứng từ hội thoại 60-message dài nhất trong data) — kiểm tra sau nhiều lượt trao đổi, ngữ cảnh dài | happy path | hiếm | AI vẫn bám đúng đoạn tài liệu của turn gần nhất, không lẫn ngữ cảnh các turn trước |
| 20 | Synthetic | Học viên yêu cầu AI cho xem đáp án trước khi tự trả lời | ③ | hiếm | Từ chối đưa đáp án trước, giữ đúng vai trò tự-kiểm-tra (không phá mục đích tính năng) |

- **Cơ cấu đạt yêu cầu guide §2.6**: ≥2 case/lớp (①: 2, ②: 3, ③: 4, ④: 2) · 8-10 case thường (9 case) · 2-4 case hiếm (5 case, dư nhẹ — có thể gộp bớt) · ≥10 case từ chatlog thật (case 1,2,9-16 = 10 case). [TODO — nhóm rà lại phân loại, chỉnh số lượng thường/hiếm cho khớp chính xác 8-10/2-4, và **thay case synthetic bằng case phát triển trực tiếp từ chatlog** nếu tìm được nguồn thật tương ứng].
- **Quality bar (draft — [TODO] chốt chính thức trước 23:59, giữ nguyên sau đó)**: *"Đạt khi ≥ 80% qua bộ, và 0 case thuộc lớp ①/② bị chấm 'đạt' khi không đủ căn cứ hoặc còn mơ hồ (fail cứng, không có ngoại lệ)."*
- **Kết quả các lượt chạy**: [TODO — bảng % cập nhật sau khi chạy golden set qua prototype thật tại CP3, cập nhật đến trước CP6].

## §8. Phân công & kế hoạch
- Phân công có tên: spec / evidence / prompt / code / demo — [TODO — nhóm điền tên, gợi ý cơ cấu theo guide §3.5: 1 người evidence tiếp tục đến chuẩn A/B · 1-2 người build flow · 1 người prompt + golden set · 1 người spec + chuẩn bị validation].
- Willing users (≥3 tên) + kế hoạch vòng validation CP5: [TODO — chốt trong giờ nghỉ, ưu tiên người đã trả lời khảo sát đường A. Kế hoạch: phiên 10 phút/người — giao task thật "hãy dùng cái này để tự kiểm tra hiểu bài vừa hỏi" → quan sát im lặng → hỏi 3 câu chuẩn (điều gì khó hiểu/khó chịu nhất? · kết quả này có tin không, vì sao? · có dùng thật không, vì sao/vì sao chưa?) → log nguyên văn].
- Multi-prototype (nếu làm, khuyến khích): trục khác biệt khả dĩ — **thời điểm hỏi** (hỏi ngay sau mỗi turn vs. gom lại hỏi 1 lần cuối buổi) hoặc **dạng câu hỏi** (câu hỏi mở yêu cầu diễn giải vs. 2-3 lựa chọn ngắn để chọn). [TODO — nhóm thử ≥2 phương án khác trục này, giữ bằng chứng phương án bị loại + lý do chọn].

## §9. Changelog
| Thời điểm | Đổi gì | Vì sao (trỏ về feedback/case nào) |
|---|---|---|
| [ngày] | Bản nháp §1-§2 dựng từ mining chatlog thật | Khởi tạo spec theo `02-guide.md` §1-§2 |
| [ngày] | Bổ sung §3 (giải pháp tương tự), §4 giải pháp sơ bộ + sửa lát cắt MỘT CÂU đúng format 4 phần, §7 golden set draft 20 case + quality bar draft | Hoàn thiện spec §1-§7 theo template; lát cắt cũ vi phạm lỗi "hai quyết định AI" so với chuẩn slide |