Hãy triển khai tính năng sinh đề quiz ngẫu nhiên từ các file Markdown trong thư mục `topic`, dựa trên cấu trúc và công nghệ hiện có của dự án.

**1. Đọc và chuẩn hóa ngân hàng câu hỏi**

- Kiểm tra cấu trúc các file Markdown trong `topic` trước khi triển khai. Ngân hàng câu hỏi gồm **3 topic**; xác định đúng câu hỏi thuộc từng topic.
- Trích xuất đầy đủ nội dung câu hỏi, các phương án, đáp án đúng và lời giải nếu có. Giữ nguyên định dạng code, công thức và hình ảnh nếu xuất hiện.
- Gán ID ổn định cho câu hỏi và từng phương án để phục vụ lấy mẫu, trộn và chấm điểm.
- Phát hiện câu hỏi lỗi định dạng, thiếu đáp án hoặc trùng nội dung. Không tự bịa câu hỏi hay đáp án để bù dữ liệu.

**2. Sinh đề quiz cân bằng**

- Mỗi đề gồm **đúng 30 câu**, lấy ngẫu nhiên **10 câu từ mỗi topic**.
- Không lặp câu hỏi trong cùng một đề.
- Sau khi chọn đủ câu, trộn thứ tự toàn bộ 30 câu để các topic xen kẽ.
- Nếu giao diện đã có nhiều đề, giữ số lượng đề hiện tại và áp dụng quy tắc trên cho từng đề. Nếu chưa có cấu hình số lượng đề, tạo một tham số cấu hình rõ ràng.
- Các đề sinh trong cùng một lượt phải khác nhau về tập câu hỏi khi dữ liệu cho phép; hạn chế tối đa câu trùng giữa các đề.
- Nếu một topic có dưới 10 câu hợp lệ, thông báo rõ topic và số câu còn thiếu, không âm thầm lấy bù từ topic khác hoặc lặp câu.

**3. Trộn phương án trả lời và bảo toàn đáp án đúng**

- Trộn ngẫu nhiên thứ tự các phương án trong từng câu, sau đó gán lại nhãn hiển thị `A`, `B`, `C`, `D` tương ứng.
- Đáp án đúng phải gắn với **ID phương án**, không phụ thuộc nhãn chữ cái hoặc vị trí ban đầu.
- Bảo đảm thao tác chọn đáp án, chấm điểm, xem kết quả và lời giải vẫn chính xác sau khi trộn.
- Với các phương án phụ thuộc vị trí như “Cả A và B”, cần xử lý tham chiếu chính xác hoặc đánh dấu để xử lý riêng; không trộn máy móc làm sai nghĩa câu hỏi.

**4. Sinh lại đề khi reload trang**

- Mỗi lần người dùng tải lại trang, hệ thống phải chạy lại quá trình chọn câu hỏi, trộn câu và trộn phương án.
- Không giữ nguyên bộ đề cũ do seed cố định, cache hoặc dữ liệu lưu trong trình duyệt.
- Trong cùng một lượt làm bài, bộ đề và thứ tự phương án phải ổn định; không sinh lại khi component re-render, chọn đáp án hoặc chuyển câu.
- Phân biệt rõ:
  - Không trùng câu trong một đề: bắt buộc.
  - Không trùng hoàn toàn tập câu hỏi với lượt tải trước: thực hiện khi ngân hàng câu hỏi còn tổ hợp khác.
  - Không bao giờ gặp lại một câu hỏi qua mọi lần tải: không thể bảo đảm với ngân hàng hữu hạn.
- Có thể lưu dấu vân tay của tập ID câu hỏi từ lượt trước để tránh sinh lại cùng tập câu khi còn lựa chọn khác. Giới hạn số lần thử để tránh vòng lặp vô hạn.
- Nếu dữ liệu chỉ đủ một tập 30 câu đáp ứng tỷ lệ 10–10–10, vẫn trộn lại câu và phương án, đồng thời nêu rõ giới hạn này.

**5. Yêu cầu triển khai và kiểm tra**

- Tái sử dụng giao diện và kiến trúc hiện có, tách rõ các phần: đọc Markdown, chuẩn hóa dữ liệu, sinh đề, trộn phương án và chấm điểm.
- Dùng thuật toán trộn phù hợp như Fisher–Yates; tránh `sort(() => Math.random() - 0.5)`.
- Kiểm tra các trường hợp: đủ 30 câu; đúng tỷ lệ 10–10–10; không lặp câu trong đề; đáp án đúng được bảo toàn sau trộn; reload sinh lại đề; re-render không đổi đề; thiếu dữ liệu được báo rõ.
- Trực tiếp triển khai vào dự án. Khi hoàn thành, tóm tắt các file đã sửa, cách hoạt động, cách kiểm tra và giới hạn còn lại nếu có.
