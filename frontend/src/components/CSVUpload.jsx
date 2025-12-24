import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';

export default function CSVUpload({ onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [preview, setPreview] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.type === 'text/csv' || selectedFile.name.endsWith('.csv')) {
        setFile(selectedFile);
        setError('');
        setSuccess(null);
      } else {
        setError('Please select a CSV file');
        setFile(null);
      }
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append('csvFile', file);

      const response = await fetch('http://localhost:4001/api/upload/reservations', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess({
          message: data.message,
          recordCount: data.recordCount
        });
        setPreview(data.preview);
        setFile(null);

        if (onUploadSuccess) {
          onUploadSuccess(data);
        }
      } else {
        setError(data.error || 'Upload failed');
      }
    } catch (err) {
      setError('Failed to upload file: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      if (droppedFile.type === 'text/csv' || droppedFile.name.endsWith('.csv')) {
        setFile(droppedFile);
        setError('');
        setSuccess(null);
      } else {
        setError('Please drop a CSV file');
      }
    }
  };

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Upload Reservation Data</h3>
      <p style={styles.description}>
        Upload your hotel reservation data in CSV format. The file should include booking dates, room types, prices, and guest information.
      </p>

      <div
        style={{
          ...styles.dropzone,
          ...(file ? styles.dropzoneActive : {})
        }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => document.getElementById('csv-file-input').click()}
      >
        <input
          id="csv-file-input"
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          style={styles.fileInput}
        />

        <Upload size={48} style={styles.uploadIcon} />

        {file ? (
          <div style={styles.fileInfo}>
            <FileText size={24} style={styles.fileIcon} />
            <p style={styles.fileName}>{file.name}</p>
            <p style={styles.fileSize}>
              {(file.size / 1024).toFixed(2)} KB
            </p>
          </div>
        ) : (
          <div style={styles.dropzoneText}>
            <p style={styles.dropzoneTitle}>
              Drop your CSV file here or click to browse
            </p>
            <p style={styles.dropzoneSubtitle}>
              Maximum file size: 10MB
            </p>
          </div>
        )}
      </div>

      {error && (
        <div style={styles.errorBox}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div style={styles.successBox}>
          <CheckCircle size={20} />
          <span>
            {success.message} - {success.recordCount} records uploaded
          </span>
        </div>
      )}

      {preview && preview.length > 0 && (
        <div style={styles.previewSection}>
          <h4 style={styles.previewTitle}>Data Preview (first 5 rows)</h4>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeaderRow}>
                  {Object.keys(preview[0]).map(key => (
                    <th key={key} style={styles.tableHeader}>{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, idx) => (
                  <tr key={idx} style={styles.tableRow}>
                    {Object.values(row).map((value, i) => (
                      <td key={i} style={styles.tableCell}>{value}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        style={{
          ...styles.uploadButton,
          opacity: (!file || uploading) ? 0.5 : 1,
          cursor: (!file || uploading) ? 'not-allowed' : 'pointer'
        }}
      >
        {uploading ? 'Uploading...' : 'Upload CSV'}
      </button>

      <div style={styles.infoBox}>
        <h4 style={styles.infoTitle}>Expected CSV Format:</h4>
        <ul style={styles.infoList}>
          <li>Booking ID</li>
          <li>Guest Name</li>
          <li>Check-in Date</li>
          <li>Check-out Date</li>
          <li>Room Type</li>
          <li>Price per Night</li>
          <li>Total Price</li>
          <li>Status (Confirmed/Cancelled/Pending)</li>
        </ul>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '24px',
    background: '#FFFFFF',
    borderRadius: '12px',
    border: '1px solid #E0D4EB',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
  },
  title: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#2C2C2C',
    margin: '0 0 8px 0'
  },
  description: {
    fontSize: '14px',
    color: '#6B6B6B',
    margin: '0 0 24px 0',
    lineHeight: '1.5'
  },
  dropzone: {
    border: '2px dashed #C099DD',
    borderRadius: '12px',
    padding: '40px 20px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.3s',
    background: '#FAFAFA',
    marginBottom: '20px'
  },
  dropzoneActive: {
    background: '#F5F0FA',
    borderColor: '#7B68BE'
  },
  fileInput: {
    display: 'none'
  },
  uploadIcon: {
    color: '#C099DD',
    marginBottom: '16px'
  },
  fileInfo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px'
  },
  fileIcon: {
    color: '#7B68BE'
  },
  fileName: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#2C2C2C',
    margin: 0
  },
  fileSize: {
    fontSize: '14px',
    color: '#6B6B6B',
    margin: 0
  },
  dropzoneText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  dropzoneTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#2C2C2C',
    margin: 0
  },
  dropzoneSubtitle: {
    fontSize: '14px',
    color: '#6B6B6B',
    margin: 0
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    background: '#FEE',
    border: '1px solid #E53E3E',
    borderRadius: '8px',
    color: '#E53E3E',
    fontSize: '14px',
    marginBottom: '16px'
  },
  successBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    background: '#E6FFED',
    border: '1px solid #48BB78',
    borderRadius: '8px',
    color: '#22543D',
    fontSize: '14px',
    marginBottom: '16px'
  },
  previewSection: {
    marginTop: '24px',
    marginBottom: '24px'
  },
  previewTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#2C2C2C',
    margin: '0 0 12px 0'
  },
  tableWrapper: {
    overflowX: 'auto',
    border: '1px solid #E0D4EB',
    borderRadius: '8px'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px'
  },
  tableHeaderRow: {
    background: '#F5F0FA'
  },
  tableHeader: {
    padding: '12px 16px',
    textAlign: 'left',
    fontWeight: '600',
    color: '#2C2C2C',
    borderBottom: '2px solid #E0D4EB'
  },
  tableRow: {
    borderBottom: '1px solid #F0F0F0'
  },
  tableCell: {
    padding: '12px 16px',
    color: '#6B6B6B'
  },
  uploadButton: {
    width: '100%',
    padding: '14px 24px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
    marginBottom: '24px'
  },
  infoBox: {
    padding: '16px',
    background: '#F5F0FA',
    borderLeft: '4px solid #C099DD',
    borderRadius: '4px'
  },
  infoTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#2C2C2C',
    margin: '0 0 12px 0'
  },
  infoList: {
    margin: 0,
    paddingLeft: '20px',
    color: '#6B6B6B',
    fontSize: '13px',
    lineHeight: '1.8'
  }
};